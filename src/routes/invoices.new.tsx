import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Protected } from "@/components/Protected";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { endpoints, type Customer, type Company, type InvoiceItem } from "@/lib/api";
import { calcGst } from "@/lib/gst";
import { formatINR } from "@/lib/seller";
import { toast } from "sonner";
import { FilePlus2, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/invoices/new")({
  component: () => (
    <Protected>
      <NewInvoice />
    </Protected>
  ),
});

function NewInvoice() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    endpoints.listCustomers().then(setCustomers).catch(() => setCustomers([]));
    endpoints.listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString().slice(0, 10);

  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [gstPercent, setGstPercent] = useState<5 | 12 | 18>(18);
  const [gstType, setGstType] = useState<"CGST_SGST" | "IGST">("CGST_SGST");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(due);
  const [status, setStatus] = useState<"PAID" | "PENDING">("PENDING");

  const [serviceTitle, setServiceTitle] = useState("AWS-SERVICES");
  const [hsnCode, setHsnCode] = useState("998315");
  const [referenceNo, setReferenceNo] = useState("");
  const [buyersOrderNo, setBuyersOrderNo] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Telangana");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [subItems, setSubItems] = useState<{ description: string; amount: number }[]>([]);

  const addSubItem = () => setSubItems((s) => [...s, { description: "", amount: 0 }]);
  const removeSubItem = (i: number) => setSubItems((s) => s.filter((_, idx) => idx !== i));
  const updateSubItem = (i: number, patch: Partial<{ description: string; amount: number }>) =>
    setSubItems((s) => s.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const calc = useMemo(() => {
    const subtotal = parseFloat(amount) || 0;
    return { subtotal, ...calcGst(subtotal, gstPercent, gstType) };
  }, [amount, gstPercent, gstType]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { toast.error("Select a customer"); return; }
    if (calc.subtotal <= 0) { toast.error("Enter a valid amount"); return; }
    const customer = customers.find((c) => c.customerId === customerId);
    const company = companies[0];
    const items: InvoiceItem[] = [
      { description: serviceTitle || "Services rendered", hsnSac: hsnCode || undefined, qty: 1, rate: calc.subtotal, amount: calc.subtotal },
      ...subItems
        .filter((s) => s.description.trim() && s.amount !== 0)
        .map((s) => ({ description: s.description, hsnSac: hsnCode || undefined, amount: s.amount })),
    ];
    try {
      const created = await endpoints.saveInvoice({
        invoiceNumber: invoiceNumber.trim() || `APOY/${Date.now().toString().slice(-4)}/25-26`,
        date: invoiceDate,
        dueDate,
        customerId,
        customerName: customer?.name,
        companyId: company?.companyId,
        referenceNo: referenceNo.trim() || undefined,
        paymentTerms: paymentTerms.trim() || undefined,
        buyerOrderNo: buyersOrderNo.trim() || undefined,
        placeOfSupply: placeOfSupply.trim() || undefined,
        items,
        gstType,
        gstPercent,
        subtotal: calc.subtotal,
        cgst: calc.cgst,
        sgst: calc.sgst,
        igst: calc.igst,
        roundOff: calc.roundOff,
        total: calc.total,
        status,
      });
      toast.success("Invoice created");
      navigate({ to: "/invoices/$id", params: { id: created.invoiceId } });
    } catch {
      toast.error("Failed to create invoice");
    }
  };

  return (
    <>
      <h1 className="text-3xl font-bold mb-6">Create Invoice</h1>
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="APOY/57/25-26" />
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder={customers.length ? "Select customer" : "Add a customer first"} /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.customerId} value={c.customerId}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Taxable Amount (₹)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
            </div>
            <div className="space-y-2">
              <Label>GST Rate</Label>
              <Select value={String(gstPercent)} onValueChange={(v) => setGstPercent(Number(v) as 5 | 12 | 18)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="12">12%</SelectItem>
                  <SelectItem value="18">18%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>GST Type</Label>
              <Select value={gstType} onValueChange={(v) => setGstType(v as "CGST_SGST" | "IGST")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CGST_SGST">CGST + SGST (intra-state)</SelectItem>
                  <SelectItem value="IGST">IGST (inter-state)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "PAID" | "PENDING")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>

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
              <div className="flex items-center justify-between">
                <Label>Sub-line Breakdown (optional)</Label>
                <Button type="button" size="sm" variant="outline" onClick={addSubItem}>
                  <Plus className="h-3 w-3 mr-1" />Add line
                </Button>
              </div>
              {subItems.length === 0 && (
                <p className="text-xs text-muted-foreground">No sub-lines. Add rows like "Data Transfer", "Setup fee".</p>
              )}
              {subItems.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                  <Input placeholder="Description" value={s.description} onChange={(e) => updateSubItem(i, { description: e.target.value })} />
                  <Input type="number" step="0.01" placeholder="Amount" value={s.amount || ""} onChange={(e) => updateSubItem(i, { amount: parseFloat(e.target.value) || 0 })} />
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeSubItem(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6 h-fit space-y-4">
          <h3 className="font-semibold">Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatINR(calc.subtotal)}</span></div>
            {gstType === "IGST" ? (
              <div className="flex justify-between"><span className="text-muted-foreground">IGST ({gstPercent}%)</span><span className="font-medium">{formatINR(calc.igst)}</span></div>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST ({gstPercent / 2}%)</span><span className="font-medium">{formatINR(calc.cgst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST ({gstPercent / 2}%)</span><span className="font-medium">{formatINR(calc.sgst)}</span></div>
              </>
            )}
            {calc.roundOff !== 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Round Off</span><span className="font-medium">{formatINR(calc.roundOff)}</span></div>
            )}
            <div className="border-t pt-2 flex justify-between text-base"><span className="font-semibold">Total</span><span className="font-bold text-primary">{formatINR(calc.total)}</span></div>
          </div>
          <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary-glow">
            <FilePlus2 className="h-4 w-4 mr-2" />Create Invoice
          </Button>
        </Card>
      </form>
    </>
  );
}
