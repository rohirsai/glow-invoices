import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/store";
import { numberToWordsINR } from "@/lib/fx";
import { SELLER, BANK, TERMS, JURISDICTION } from "@/lib/seller";
import { Download, ArrowLeft } from "lucide-react";
import logoUrl from "@/assets/apoyphe-logo-black.png";
import { generateInvoicePDF } from "@/lib/invoicePdf";
import { toast } from "sonner";

export const Route = createFileRoute("/invoices/$id")({
  head: () => ({ meta: [{ title: "Tax Invoice — Apoyphe" }] }),
  component: InvoicePreview,
});

/** ₹ formatter without the leading symbol — for table cells. */
const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

/** Format invoice date as "07-Feb-26". */
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleString("en-US", { month: "short" });
  const yr = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
};

function tinyAmountInWords(n: number, currency = "INR") {
  // Re-use existing util; tweak prefix.
  const words = numberToWordsINR(Math.abs(n))
    .replace(" Rupees", " Rupee")
    .replace(" Paise", " Paisa");
  return `${currency} ${words}.`;
}

function InvoicePreview() {
  const { id } = Route.useParams();
  const invoice = useData((s: any) => s.invoices.find((i: any) => i.id === id));
  const customer = useData((s: any) => s.customers.find((c: any) => c.id === invoice?.customerId));
  const [isDownloading, setIsDownloading] = useState(false);
  if (!invoice || !customer) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="p-8 text-center">
            <p className="text-lg font-semibold mb-4">Invoice not found</p>
            <Link to="/invoices">
              <Button variant="outline">Back to Invoices</Button>
            </Link>
          </Card>
        </div>
      </AppShell>
    );
  }

  const subtotal = invoice.amount ?? 0;
  const gstAmount = invoice.gstAmount ?? 0;
  const halfRate = invoice.gstRate / 2;
  const halfTax = gstAmount / 2;
  const isIgst = invoice.gstType === "IGST";
  const utLabel = invoice.gstType === "CGST_UTGST" ? "UTGST" : "SGST";
  const roundOff = invoice.roundOff ?? 0;
  const grandTotal = invoice.total + roundOff;
  const consigneeSame = invoice.consigneeSameAsBuyer ?? true;

  // ---------------------------- PDF generation ---------------------------- //
  // Native jsPDF text rendering — no DOM capture, no oklch issues.
  const downloadPDF = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await generateInvoicePDF(invoice, customer);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  // -------------------------- On-screen preview --------------------------- //
  return (
    <AppShell>
      <div className="px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/invoices">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Invoice {invoice.invoiceNumber}</h1>
          </div>
          <Button
            onClick={downloadPDF}
            disabled={isDownloading}
            className="bg-gradient-to-r from-primary to-primary-glow"
          >
            <Download className="h-4 w-4 mr-2" />
            {isDownloading ? "Preparing..." : "Download PDF"}
          </Button>
        </div>

      <Card
        className="p-6 max-w-4xl mx-auto shadow-elegant border-2 border-foreground/80 text-foreground bg-background text-[12px] leading-snug"
      >
        <h2 className="text-center text-xl font-bold tracking-wide mb-3">TAX INVOICE</h2>

        {/* Header grid */}
        <div className="grid grid-cols-[1.2fr_1fr] border border-foreground/80">
          <div className="p-2 border-r border-foreground/80 flex gap-3 items-start">
            <img src={logoUrl} alt="Apoyphe logo" className="h-12 w-12 object-contain shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-[13px]">{SELLER.name}</p>
              <p className="whitespace-pre-line">{SELLER.address}</p>
              <p>GSTIN: {SELLER.gstin}</p>
              <p>
                State Name: {SELLER.stateName}, Code: {SELLER.stateCode}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 grid-rows-3">
            {[
              ["Invoice No.", invoice.invoiceNumber],
              ["Dated", fmtDate(invoice.invoiceDate)],
              ["Reference No. & Date", invoice.referenceNo || "—"],
              ["Mode/Terms of Payment", invoice.paymentTerms || `Due ${fmtDate(invoice.dueDate)}`],
              ["Buyer's Order No.", invoice.buyerOrderNo || "—"],
              ["Other References", invoice.status?.toUpperCase() || "—"],
            ].map(([label, value], i) => (
              <div
                key={i}
                className="border-l border-b border-foreground/80 first:border-l-0 [&:nth-child(2)]:border-l [&:nth-child(5)]:border-b-0 [&:nth-child(6)]:border-b-0"
              >
                <p className="text-[10px] font-bold text-foreground px-2 py-0.5">{label}</p>
                <p className="font-semibold px-2 py-1">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Buyer / Consignee */}
        <div className="grid grid-cols-2 border-x border-b border-foreground/80">
          {["Buyer (Bill to)", "Consignee (Ship to)"].map((title, idx) => (
            <div key={idx} className={`${idx === 0 ? "border-r border-foreground/80" : ""}`}>
              <p className="text-[10px] font-bold text-foreground px-2 py-0.5">{title}</p>
              <div className="p-2">
                <p className="font-bold">{customer.name}</p>
                <p className="whitespace-pre-line">{customer.address}</p>
                {customer.gstin && <p>GSTIN/UIN: {customer.gstin}</p>}
                <p>State Name: {invoice.placeOfSupply || SELLER.stateName}, Code: 36</p>
                <p>Place of Supply: {invoice.placeOfSupply || SELLER.stateName}</p>
                {!consigneeSame && idx === 1 && (
                  <p className="italic text-muted-foreground mt-1">(Same as buyer)</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Items table */}
        <table className="w-full border-x border-b border-foreground/80 border-collapse">
          <thead>
            <tr className="border-b border-foreground/80 bg-muted/30 text-[11px]">
              <th className="border-r border-foreground/80 px-2 py-1.5 w-8">Sl</th>
              <th className="border-r border-foreground/80 px-2 py-1.5 text-left">
                Description of Services
              </th>
              <th className="border-r border-foreground/80 px-2 py-1.5 w-16">HSN/SAC</th>
              <th className="border-r border-foreground/80 px-2 py-1.5 w-12">GST</th>
              <th className="border-r border-foreground/80 px-2 py-1.5 w-10">Qty</th>
              <th className="border-r border-foreground/80 px-2 py-1.5 w-20 text-right">Rate</th>
              <th className="px-2 py-1.5 w-24 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const taxLines: { label: string; amount: number }[] = [];
              if (isIgst) {
                taxLines.push({ label: "IGST", amount: invoice.gstAmount });
              } else {
                taxLines.push({ label: "CGST", amount: halfTax });
                taxLines.push({ label: utLabel, amount: halfTax });
              }
              if (roundOff !== 0) {
                taxLines.push({ label: "Round Off", amount: roundOff });
              }
              const subN = invoice.subItems?.length ?? 0;
              const sideSpan = 1 + subN + taxLines.length;
              const fmtTax = (line: { label: string; amount: number }) =>
                line.label === "Round Off" && line.amount < 0
                  ? `(-) ${fmt(Math.abs(line.amount))}`
                  : fmt(line.amount);
              return (
                <>
                  <tr>
                    <td
                      rowSpan={sideSpan}
                      className="border-r border-foreground/80 text-center align-top py-1.5 px-2"
                    >
                      1
                    </td>
                    <td className="px-2 py-1 font-bold text-center border-r border-foreground/80">
                      {invoice.serviceTitle || "Services rendered"}
                    </td>
                    <td
                      rowSpan={sideSpan}
                      className="border-r border-foreground/80 text-center align-top py-1.5 px-2"
                    >
                      {invoice.hsnCode || "—"}
                    </td>
                    <td
                      rowSpan={sideSpan}
                      className="border-r border-foreground/80 text-center align-top py-1.5 px-2"
                    >
                      {invoice.gstRate}%
                    </td>
                    <td
                      rowSpan={sideSpan}
                      className="border-r border-foreground/80 text-center align-top py-1.5 px-2"
                    >
                      1
                    </td>
                    <td className="px-2 py-1 text-right font-bold border-r border-foreground/80">{fmt(subtotal)}</td>
                    <td className="px-2 py-1 text-right font-bold">{fmt(subtotal)}</td>
                  </tr>
                  {(invoice.subItems ?? []).map((s: any, i: number) => (
                    <tr key={`sub-${i}`}>
                      <td className={`px-2 py-1 text-center border-r border-foreground/80 ${s.italic ? "italic" : ""}`}>
                        {s.label}
                      </td>
                      <td className="px-2 py-1 text-right border-r border-foreground/80">{fmt(s.amount)}</td>
                      <td className="px-2 py-1 text-right">{fmt(s.amount)}</td>
                    </tr>
                  ))}
                  {taxLines.map((line, i) => (
                    <tr key={`tax-${i}`}>
                      <td className="px-2 py-1 text-right italic relative border-r border-foreground/80">
                        {i === 0 && (
                          <span className="absolute left-2 not-italic">Add :</span>
                        )}
                        {line.label}
                      </td>
                      <td className="px-2 py-1 text-right border-r border-foreground/80">{fmtTax(line)}</td>
                      <td className="px-2 py-1 text-right">{fmtTax(line)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-foreground/80 font-bold">
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5 text-right border-r border-foreground/80">Total</td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5 text-center">1 nos</td>
                    <td className="px-2 py-1.5 text-right border-r border-foreground/80">{fmt(subtotal)}</td>
                    <td className="px-2 py-1.5 text-right">Rs. {fmt(grandTotal)}</td>
                  </tr>
                </>
              );
            })()}
          </tbody>
        </table>

        {/* Amount in words */}
        <div className="border-x border-b border-foreground/80 p-2">
          <p className="text-[11px]">Amount Chargeable Including Tax (in words)</p>
          <p className="font-bold">{tinyAmountInWords(grandTotal)}</p>
          <p className="text-right italic text-[10px] text-muted-foreground">E. &amp; O.E</p>
        </div>

        {/* HSN tax summary */}
        <table className="w-full border-x border-b border-foreground/80 border-collapse text-[11px]">
          <thead>
            <tr className="bg-muted/30">
              <th className="border border-foreground/80 px-1 py-1" rowSpan={2}>
                HSN/SAC
              </th>
              <th className="border border-foreground/80 px-1 py-1" rowSpan={2}>
                Taxable Value
              </th>
              {isIgst ? (
                <>
                  <th className="border border-foreground/80 px-1 py-1" colSpan={2}>
                    Integrated Tax
                  </th>
                  <th className="border border-foreground/80 px-1 py-1" rowSpan={2}>
                    Total Tax
                  </th>
                </>
              ) : (
                <>
                  <th className="border border-foreground/80 px-1 py-1" colSpan={2}>
                    Central Tax
                  </th>
                  <th className="border border-foreground/80 px-1 py-1" colSpan={2}>
                    State Tax
                  </th>
                  <th className="border border-foreground/80 px-1 py-1" rowSpan={2}>
                    Total Tax
                  </th>
                </>
              )}
            </tr>
            <tr>
              <th className="border border-foreground/80 px-1 py-1">Rate</th>
              <th className="border border-foreground/80 px-1 py-1">Amount</th>
              {!isIgst && (
                <>
                  <th className="border border-foreground/80 px-1 py-1">Rate</th>
                  <th className="border border-foreground/80 px-1 py-1">Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-foreground/80 text-center px-1 py-1">
                {invoice.hsnCode || "—"}
              </td>
              <td className="border border-foreground/80 text-right px-1 py-1">{fmt(subtotal)}</td>
              <td className="border border-foreground/80 text-center px-1 py-1">
                {isIgst ? invoice.gstRate : halfRate}%
              </td>
              <td className="border border-foreground/80 text-right px-1 py-1">
                {fmt(isIgst ? invoice.gstAmount : halfTax)}
              </td>
              {!isIgst && (
                <>
                  <td className="border border-foreground/80 text-center px-1 py-1">{halfRate}%</td>
                  <td className="border border-foreground/80 text-right px-1 py-1">
                    {fmt(halfTax)}
                  </td>
                </>
              )}
              <td className="border border-foreground/80 text-right px-1 py-1">
                {fmt(invoice.gstAmount)}
              </td>
            </tr>
            <tr className="font-bold">
              <td className="border border-foreground/80 text-center px-1 py-1">Total</td>
              <td className="border border-foreground/80 text-right px-1 py-1">{fmt(subtotal)}</td>
              <td className="border border-foreground/80 px-1 py-1"></td>
              <td className="border border-foreground/80 text-right px-1 py-1">
                {fmt(isIgst ? invoice.gstAmount : halfTax)}
              </td>
              {!isIgst && (
                <>
                  <td className="border border-foreground/80 px-1 py-1"></td>
                  <td className="border border-foreground/80 text-right px-1 py-1">
                    {fmt(halfTax)}
                  </td>
                </>
              )}
              <td className="border border-foreground/80 text-right px-1 py-1">
                {fmt(invoice.gstAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="px-1 py-2 text-[11px]">
          Tax Amount (in words):{" "}
          <span className="font-bold">{tinyAmountInWords(invoice.gstAmount)}</span>
        </p>

        {/* Bank */}
        <div className="border border-foreground/80 p-2 mt-1 text-[11px]">
          <p className="font-bold">Company's Bank Details:</p>
          <p>A/c Holder's Name : {BANK.accountName}</p>
          <p>Bank Name : {BANK.bankName}</p>
          <p>A/c No. : {BANK.accountNo}</p>
          <p>Branch &amp; IFS Code : {BANK.branchAndIfsc}</p>
        </div>

        {/* Terms + Signatory */}
        <div className="grid grid-cols-2 border-x border-b border-foreground/80 text-[11px]">
          <div className="p-2 border-r border-foreground/80">
            <p className="font-bold">Terms and Conditions:</p>
            <ol className="list-decimal pl-4 space-y-0.5 mt-1">
              {TERMS.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
          <div className="p-2 flex flex-col justify-between">
            <p className="font-bold text-right">for {SELLER.name}</p>
          </div>
        </div>

        <p className="text-center font-bold mt-2">{JURISDICTION}</p>
        <p className="text-center italic text-[10px] text-muted-foreground">
          This is a Computer Generated Invoice
        </p>
      </Card>
      </div>
    </AppShell>
  );
}
