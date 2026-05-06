import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData, type Invoice, type GstType, type InvoiceSubItem } from "@/lib/store";
import { getUsdToInr, formatINR } from "@/lib/fx";

import { toast } from "sonner";
import { FilePlus2, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/invoices/new")({
  head: () => ({ meta: [{ title: "Create Invoice — Apoyphe" }] }),
  component: NewInvoice,
});

function NewInvoice() {
  const customers = useData((s: any) => s.customers);
  const addInvoice = useData((s: any) => s.addInvoice);
  const company = useData((s: any) => s.company);
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString().slice(0, 10);

  const [customerId, setCustomerId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [gstRate, setGstRate] = useState<5 | 12 | 18>(18);
  const [gstType, setGstType] = useState<GstType>("CGST_SGST");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(due);
  const [status, setStatus] = useState<"PAID" | "PENDING">("PENDING");
  const [fxRate, setFxRate] = useState(83.5);

  // Tally-style fields
  const [serviceTitle, setServiceTitle] = useState("AWS-SERVICES");
  const [hsnCode, setHsnCode] = useState("998315");
  const [referenceNo, setReferenceNo] = useState("");
  const [buyersOrderNo, setBuyersOrderNo] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Telangana");
  const [roundOff, setRoundOff] = useState("0");
  const [subItems, setSubItems] = useState<InvoiceSubItem[]>([]);

  const addSubItem = () => setSubItems((s) => [...s, { label: "", amount: 0 }]);
  const removeSubItem = (i: number) => setSubItems((s) => s.filter((_, idx) => idx !== i));
  const updateSubItem = (i: number, patch: Partial<InvoiceSubItem>) =>
    setSubItems((s) => s.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  useEffect(() => { getUsdToInr().then(setFxRate); }, []);

  const calc = useMemo(() => {
    const orig = parseFloat(amount) || 0;
    const inr = currency === "USD" ? orig * fxRate : orig;
    const gstAmount = (inr * gstRate) / 100;
    const total = inr + gstAmount;
    return { orig, inr, gstAmount, total };
  }, [amount, currency, fxRate, gstRate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) { toast.error("Save your company details first"); navigate({ to: "/companies" }); return; }
    if (!customerId) { toast.error("Select a customer"); return; }
    if (calc.orig <= 0) { toast.error("Enter a valid amount"); return; }
    const ro = parseFloat(roundOff) || 0;
    const inv: Omit<Invoice, "id" | "invoiceId" | "invoiceNumber" | "date" | "gstPercent" | "subtotal" | "cgst" | "sgst" | "igst" | "items"> = {
      customerId, 
      amount: calc.inr, 
      originalAmount: calc.orig, 
      currency,
      fxRate: currency === "USD" ? fxRate : 1,
      gstRate, 
      gstType, 
      gstAmount: calc.gstAmount, 
      total: calc.total,
      status, 
      invoiceDate, 
      dueDate,
      companyId: company.companyId,
      customerName: customers.find(c => c.id === customerId)?.name,
      serviceTitle: serviceTitle.trim() || undefined,
      hsnCode: hsnCode.trim() || undefined,
      referenceNo: referenceNo.trim() || undefined,
      buyerOrderNo: buyersOrderNo.trim() || undefined,
      paymentTerms: paymentTerms.trim() || undefined,
      placeOfSupply: placeOfSupply.trim() || undefined,
      consigneeSameAsBuyer: true,
      roundOff: ro || undefined,
      subItems: subItems.filter((s) => s.label.trim() && s.amount > 0),
    };
    const created = addInvoice(inv);
    toast.success("Invoice created");
    navigate({ to: "/invoices/$id", params: { id: created.id } });
  };

  return (
    <AppShell>
      <div className="px-8 py-6">
        <h1 className="text-3xl font-bold mb-6">Create Invoice</h1>
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder={customers.length ? "Select customer" : "Add a customer first"} /></SelectTrigger>
              <SelectContent>
                {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "INR" | "USD")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="INR">INR ₹</SelectItem><SelectItem value="USD">USD $</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          {currency === "USD" && (
            <p className="text-xs text-muted-foreground -mt-2">Live rate: 1 USD = ₹{fxRate.toFixed(2)}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>GST Rate</Label>
              <Select value={String(gstRate)} onValueChange={(v) => setGstRate(Number(v) as 5 | 12 | 18)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="5">5%</SelectItem><SelectItem value="12">12%</SelectItem><SelectItem value="18">18%</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>GST Type</Label>
              <Select value={gstType} onValueChange={(v) => setGstType(v as GstType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CGST_SGST">CGST + SGST (intra-state)</SelectItem>
                  <SelectItem value="IGST">IGST (inter-state)</SelectItem>
                  <SelectItem value="CGST_UTGST">CGST + UTGST (union territory)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "PAID" | "PENDING")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="PAID">Paid</SelectItem></SelectContent>
            </Select>
          </div>

          {/* ---- Tax invoice (Tally style) details ---- */}
          <div className="pt-4 border-t space-y-4">
            <h3 className="font-semibold text-sm">Tax Invoice Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Service Title</Label>
                <Input value={serviceTitle} onChange={(e) => setServiceTitle(e.target.value)} placeholder="AWS-SERVICES" />
              </div>
              <div className="space-y-2">
                <Label>HSN/SAC Code</Label>
                <Input value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} placeholder="998315" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Reference No.</Label>
                <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="PO-2026-001" />
              </div>
              <div className="space-y-2">
                <Label>Buyer's Order No.</Label>
                <Input value={buyersOrderNo} onChange={(e) => setBuyersOrderNo(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Place of Supply</Label>
                <Input value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} placeholder="Telangana" />
              </div>
              <div className="space-y-2">
                <Label>Mode/Terms of Payment</Label>
                <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="NEFT 15 days" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Round Off (₹)</Label>
              <Input type="number" step="0.01" value={roundOff} onChange={(e) => setRoundOff(e.target.value)} placeholder="0.00 (use negative for deduction)" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Sub-line Breakdown (optional)</Label>
                <Button type="button" size="sm" variant="outline" onClick={addSubItem}>
                  <Plus className="h-3 w-3 mr-1" />Add line
                </Button>
              </div>
              {subItems.length === 0 && (
                <p className="text-xs text-muted-foreground">No sub-lines. Add rows like "Data Transfer", "Setup fee" shown under the main service.</p>
              )}
              {subItems.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                  <Input
                    placeholder="Description"
                    value={s.label}
                    onChange={(e) => updateSubItem(i, { label: e.target.value })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={s.amount || ""}
                    onChange={(e) => updateSubItem(i, { amount: parseFloat(e.target.value) || 0 })}
                  />
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeSubItem(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6 h-fit space-y-4 bg-[image:var(--gradient-card)]">
          <h3 className="font-semibold">Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (INR)</span><span className="font-medium">{formatINR(calc.inr)}</span></div>
            {gstType === "IGST" ? (
              <div className="flex justify-between"><span className="text-muted-foreground">IGST ({gstRate}%)</span><span className="font-medium">{formatINR(calc.gstAmount)}</span></div>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST ({gstRate / 2}%)</span><span className="font-medium">{formatINR(calc.gstAmount / 2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{gstType === "CGST_UTGST" ? "UTGST" : "SGST"} ({gstRate / 2}%)</span><span className="font-medium">{formatINR(calc.gstAmount / 2)}</span></div>
              </>
            )}
            <div className="border-t pt-2 flex justify-between text-base"><span className="font-semibold">Total</span><span className="font-bold text-primary">{formatINR(calc.total)}</span></div>
          </div>
          <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary-glow"><FilePlus2 className="h-4 w-4 mr-2" />Create Invoice</Button>
        </Card>
      </form>
      </div>
    </AppShell>
  );
}
