import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { endpoints, type Customer, type Company, type InvoiceItem } from "@/lib/api";
import { calcGst, numberToWordsIndian } from "@/lib/gst";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invoices/new")({
  component: () => (
    <Protected>
      <NewInvoicePage />
    </Protected>
  ),
});

function NewInvoicePage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", hsnSac: "998315", qty: 1, rate: 0, amount: 0 },
  ]);
  const [gstType, setGstType] = useState<"CGST_SGST" | "IGST">("CGST_SGST");
  const [gstPercent, setGstPercent] = useState(18);
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [buyerOrderNo, setBuyerOrderNo] = useState("");
  const [otherReferences, setOtherReferences] = useState("");

  useEffect(() => {
    endpoints.listCustomers().then(setCustomers).catch(() => setCustomers([]));
    endpoints.listCompanies().then((cs) => {
      setCompanies(cs);
      if (cs[0]) setCompanyId(cs[0].companyId);
    }).catch(() => setCompanies([]));
  }, []);

  const subtotal = useMemo(() => items.reduce((s, i) => s + (Number(i.amount) || 0), 0), [items]);
  const breakdown = useMemo(() => calcGst(subtotal, gstPercent, gstType), [subtotal, gstPercent, gstType]);
  const words = useMemo(() => numberToWordsIndian(breakdown.total), [breakdown.total]);

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setItems((arr) =>
      arr.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        // Auto-calc amount when qty or rate provided
        if (patch.qty != null || patch.rate != null) {
          const q = Number(next.qty) || 0;
          const r = Number(next.rate) || 0;
          if (q && r) next.amount = +(q * r).toFixed(2);
        }
        return next;
      }),
    );
  };

  const save = async () => {
    if (!customerId) { toast.error("Select a customer"); return; }
    if (items.length === 0 || items.some((i) => !i.description)) {
      toast.error("Fill in all item descriptions");
      return;
    }
    const customer = customers.find((c) => c.customerId === customerId);
    const inv = {
      invoiceNumber,
      date,
      customerId,
      customerName: customer?.name,
      companyId,
      referenceNo,
      paymentTerms,
      buyerOrderNo,
      otherReferences,
      items,
      gstType,
      gstPercent,
      subtotal,
      ...breakdown,
      status: "PENDING" as const,
    };
    const saved = await endpoints.saveInvoice(inv);
    toast.success("Invoice created");
    navigate({ to: "/invoices/$id", params: { id: saved.invoiceId } });
  };

  return (
    <>
      <PageHeader title="New Invoice" subtitle="Create a GST invoice" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div><Label>Invoice Number</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></div>
              <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div>
                <Label>Company (issuer)</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => <SelectItem key={c.companyId} value={c.companyId}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.customerId} value={c.customerId}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4">
                <div><Label>Reference No. &amp; Date</Label><Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} /></div>
                <div><Label>Mode/Terms of Payment</Label><Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></div>
                <div><Label>Buyer's Order No.</Label><Input value={buyerOrderNo} onChange={(e) => setBuyerOrderNo(e.target.value)} /></div>
                <div><Label>Other References</Label><Input value={otherReferences} onChange={(e) => setOtherReferences(e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Items</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setItems([...items, { description: "", hsnSac: items[0]?.hsnSac || "998315", qty: 1, rate: 0, amount: 0 }])}>
                <Plus className="h-4 w-4 mr-1" /> Add row
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-4"
                    placeholder="Description of service"
                    value={it.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                  />
                  <Input
                    className="col-span-2"
                    placeholder="HSN/SAC"
                    value={it.hsnSac || ""}
                    onChange={(e) => updateItem(idx, { hsnSac: e.target.value })}
                  />
                  <Input
                    className="col-span-1"
                    type="number"
                    placeholder="Qty"
                    value={it.qty || ""}
                    onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    placeholder="Rate"
                    value={it.rate || ""}
                    onChange={(e) => updateItem(idx, { rate: Number(e.target.value) })}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    placeholder="Amount"
                    value={it.amount || ""}
                    onChange={(e) => updateItem(idx, { amount: Number(e.target.value) })}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="col-span-1"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tax</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>GST Type</Label>
                <Select value={gstType} onValueChange={(v) => setGstType(v as "CGST_SGST" | "IGST")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CGST_SGST">CGST + SGST (intra-state)</SelectItem>
                    <SelectItem value="IGST">IGST (inter-state)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>GST %</Label>
                <Input type="number" value={gstPercent} onChange={(e) => setGstPercent(Number(e.target.value))} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Subtotal" value={subtotal} />
              {gstType === "CGST_SGST" ? (
                <>
                  <Row label={`CGST (${gstPercent / 2}%)`} value={breakdown.cgst} />
                  <Row label={`SGST (${gstPercent / 2}%)`} value={breakdown.sgst} />
                </>
              ) : (
                <Row label={`IGST (${gstPercent}%)`} value={breakdown.igst} />
              )}
              <div className="border-t pt-2 flex justify-between font-semibold text-base">
                <span>Total</span><span>₹{breakdown.total.toLocaleString("en-IN")}</span>
              </div>
              <p className="text-xs text-muted-foreground italic">{words}</p>
              <Button className="w-full mt-3" onClick={save}>Create Invoice</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>₹{value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
    </div>
  );
}
