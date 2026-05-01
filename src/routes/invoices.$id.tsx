import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { endpoints, type Invoice, type Company, type Customer } from "@/lib/api";
import { numberToWordsIndian } from "@/lib/gst";
import { generateInvoicePdf } from "@/lib/pdf";

export const Route = createFileRoute("/invoices/$id")({
  component: () => (
    <Protected>
      <InvoiceDetail />
    </Protected>
  ),
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    (async () => {
      const list = await endpoints.listInvoices();
      const inv = list.find((i) => i.invoiceId === id) || null;
      setInvoice(inv);
      if (inv) {
        const [companies, customers] = await Promise.all([
          endpoints.listCompanies(),
          endpoints.listCustomers(),
        ]);
        setCompany(companies.find((c) => c.companyId === inv.companyId) || null);
        setCustomer(customers.find((c) => c.customerId === inv.customerId) || null);
      }
    })();
  }, [id]);

  if (!invoice) {
    return (
      <>
        <PageHeader title="Invoice" />
        <p className="text-sm text-muted-foreground">Loading or not found.</p>
        <Link to="/invoices" className="text-primary text-sm">← Back to invoices</Link>
      </>
    );
  }

  const words = numberToWordsIndian(invoice.total);

  const downloadPdf = () => {
    generateInvoicePdf({ invoice, company, customer, words });
  };

  return (
    <>
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        subtitle={`Date: ${invoice.date} · Status: ${invoice.status}`}
        actions={
          <div className="flex gap-2">
            <Link to="/invoices"><Button variant="outline">Back</Button></Link>
            <Button onClick={downloadPdf}>Download PDF</Button>
          </div>
        }
      />
      <Card>
        <CardContent className="p-8 bg-white">
          <div className="flex justify-between mb-8">
            <div>
              <div className="text-xs uppercase text-muted-foreground">From</div>
              <div className="font-semibold text-lg">{company?.name || "—"}</div>
              <div className="text-sm whitespace-pre-line">{company?.address}</div>
              <div className="text-sm">GSTIN: {company?.gstin}</div>
              <div className="text-sm">{company?.email}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase text-muted-foreground">To</div>
              <div className="font-semibold text-lg">{customer?.name || invoice.customerName}</div>
              <div className="text-sm whitespace-pre-line">{customer?.address}</div>
              <div className="text-sm">GSTIN: {customer?.gstin}</div>
            </div>
          </div>

          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-2 border">#</th>
                <th className="text-left p-2 border">Description</th>
                <th className="text-center p-2 border">HSN/SAC</th>
                <th className="text-center p-2 border">Qty</th>
                <th className="text-right p-2 border">Rate (₹)</th>
                <th className="text-right p-2 border">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it, i) => (
                <tr key={i}>
                  <td className="p-2 border">{i + 1}</td>
                  <td className="p-2 border">{it.description}</td>
                  <td className="p-2 border text-center">{it.hsnSac || "—"}</td>
                  <td className="p-2 border text-center">{it.qty ?? "—"}</td>
                  <td className="p-2 border text-right">{it.rate != null ? Number(it.rate).toLocaleString("en-IN") : "—"}</td>
                  <td className="p-2 border text-right">{Number(it.amount).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mt-6">
            <div className="w-72 space-y-1 text-sm">
              <Row label="Subtotal" value={invoice.subtotal} />
              {invoice.gstType === "CGST_SGST" ? (
                <>
                  <Row label={`CGST (${invoice.gstPercent / 2}%)`} value={invoice.cgst} />
                  <Row label={`SGST (${invoice.gstPercent / 2}%)`} value={invoice.sgst} />
                </>
              ) : (
                <Row label={`IGST (${invoice.gstPercent}%)`} value={invoice.igst} />
              )}
              <div className="border-t pt-1 flex justify-between font-semibold">
                <span>Total</span><span>₹{invoice.total.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm italic">Amount in words: {words}</p>
        </CardContent>
      </Card>
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
