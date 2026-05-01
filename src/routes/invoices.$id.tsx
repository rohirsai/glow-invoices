import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { endpoints, type Invoice, type Company, type Customer } from "@/lib/api";
import { numberToWordsIndian } from "@/lib/gst";
import { Download, ArrowLeft } from "lucide-react";
import logoUrl from "@/assets/apoyphe-logo-black.png";

export const Route = createFileRoute("/invoices/$id")({
  head: () => ({ meta: [{ title: "Tax Invoice — Apoyphe" }] }),
  component: () => (
    <Protected>
      <InvoicePreview />
    </Protected>
  ),
});

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleString("en-US", { month: "short" });
  const yr = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
};

function tinyAmountInWords(n: number, currency = "INR") {
  const words = numberToWordsIndian(Math.abs(n))
    .replace(" Rupees", " Rupee")
    .replace(" Paise", " Paisa");
  return `${currency} ${words}.`;
}

const TERMS = [
  "Payment due within terms stated above.",
  "Interest @ 18% p.a. on overdue invoices.",
  "Subject to jurisdiction of local courts.",
];
const JURISDICTION = "SUBJECT TO JURISDICTION";

function InvoicePreview() {
  const { id } = Route.useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

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
        setCompany(companies.find((c) => c.companyId === inv.companyId) || companies[0] || null);
        setCustomer(customers.find((c) => c.customerId === inv.customerId) || null);
      }
    })();
  }, [id]);

  if (!invoice || !customer) {
    return (
      <>
        <PageHeader title="Invoice" />
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Invoice or customer not found.</p>
          <Link to="/invoices">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </Card>
      </>
    );
  }

  const isIgst = invoice.gstType === "IGST";
  const subtotal = invoice.subtotal;
  const halfRate = invoice.gstPercent / 2;
  const halfTax = isIgst ? 0 : invoice.cgst;
  const totalTax = isIgst ? invoice.igst : invoice.cgst + invoice.sgst;
  const roundOff = invoice.roundOff ?? 0;
  const grandTotal = invoice.total;
  const firstItem = invoice.items[0];
  const hsnCode = firstItem?.hsnSac || "—";
  const serviceTitle = firstItem?.description || "Services rendered";
  const subItems = invoice.items.slice(1);
  const consigneeSame = true;
  const placeOfSupply = customer.placeOfSupply || customer.stateName || company?.stateName || "";
  const stateCode = customer.stateCode || company?.stateCode || "—";

  const downloadPDF = async () => {
    const el = printRef.current;
    if (!el || isDownloading) return;
    setIsDownloading(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        onclone: (_doc, clonedEl) => {
          const root = clonedEl as HTMLElement;
          root.style.backgroundColor = "#ffffff";
          root.style.color = "#111827";
          root.style.borderColor = "#1f2937";
          root.style.boxShadow = "none";
          root.querySelectorAll<HTMLElement>("*").forEach((node) => {
            const classes = node.className.toString();
            node.style.color = classes.includes("text-muted") ? "#52525b" : "#111827";
            node.style.borderColor = "#1f2937";
            node.style.boxShadow = "none";
            if (classes.includes("bg-muted")) {
              node.style.backgroundColor = "#f4f4f5";
            } else if (node.tagName !== "IMG") {
              node.style.backgroundColor = "#ffffff";
            }
          });
        },
      });

      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentW = pageW - margin * 2;
      const contentH = pageH - margin * 2;

      const imgW = contentW;
      const imgH = (canvas.height * imgW) / canvas.width;

      if (imgH <= contentH) {
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, imgW, imgH);
      } else {
        const pxPerPt = canvas.width / imgW;
        const pageHeightPx = contentH * pxPerPt;
        let renderedPx = 0;
        while (renderedPx < canvas.height) {
          const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeightPx;
          const ctx = pageCanvas.getContext("2d");
          if (!ctx) break;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            renderedPx,
            canvas.width,
            sliceHeightPx,
            0,
            0,
            canvas.width,
            sliceHeightPx,
          );
          const sliceH = sliceHeightPx / pxPerPt;
          if (renderedPx > 0) pdf.addPage();
          pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", margin, margin, imgW, sliceH);
          renderedPx += sliceHeightPx;
        }
      }

      pdf.save(`${invoice.invoiceNumber}.pdf`);
    } finally {
      setIsDownloading(false);
    }
  };

  const rowSpanCount = 6 + subItems.length + (roundOff ? 1 : 0);

  return (
    <>
      <PageHeader title={`Invoice ${invoice.invoiceNumber}`} />
      <div className="flex items-center justify-between mb-4">
        <Link to="/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
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
        ref={printRef}
        className="p-6 max-w-4xl mx-auto shadow-elegant border-2 border-foreground/80 text-foreground bg-background text-[12px] leading-snug"
      >
        <h2 className="text-center text-xl font-bold tracking-wide mb-3">TAX INVOICE</h2>

        {/* Header grid */}
        <div className="grid grid-cols-[1.2fr_1fr] border border-foreground/80">
          <div className="p-2 border-r border-foreground/80 flex gap-3 items-start">
            <img src={logoUrl} alt="Apoyphe logo" className="h-12 w-12 object-contain shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-[13px]">{company?.name || "—"}</p>
              <p className="whitespace-pre-line">{company?.address}</p>
              <p>GSTIN: {company?.gstin}</p>
              <p>
                State Name: {company?.stateName || "—"}, Code: {company?.stateCode || "—"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 grid-rows-3">
            {[
              ["Invoice No.", invoice.invoiceNumber],
              ["Dated", fmtDate(invoice.date)],
              ["Reference No. & Date", invoice.referenceNo || "—"],
              ["Mode/Terms of Payment", invoice.paymentTerms || "—"],
              ["Buyer's Order No.", invoice.buyerOrderNo || "—"],
              ["Other References", invoice.otherReferences || invoice.status],
            ].map(([label, value], i) => (
              <div
                key={i}
                className="p-2 border-l border-b border-foreground/80 first:border-l-0 [&:nth-child(2)]:border-l [&:nth-child(5)]:border-b-0 [&:nth-child(6)]:border-b-0"
              >
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Buyer / Consignee */}
        <div className="grid grid-cols-2 border-x border-b border-foreground/80">
          {["Buyer (Bill to)", "Consignee (Ship to)"].map((title, idx) => (
            <div key={idx} className={`p-2 ${idx === 0 ? "border-r border-foreground/80" : ""}`}>
              <p className="text-[10px] text-muted-foreground">{title}</p>
              <p className="font-bold">{customer.name}</p>
              <p className="whitespace-pre-line">{customer.address}</p>
              {customer.gstin && <p>GSTIN/UIN: {customer.gstin}</p>}
              <p>State Name: {placeOfSupply || "—"}, Code: {stateCode}</p>
              <p>Place of Supply: {placeOfSupply || "—"}</p>
              {consigneeSame && idx === 1 && (
                <p className="italic text-muted-foreground mt-1">(Same as buyer)</p>
              )}
            </div>
          ))}
        </div>

        {/* Items table */}
        <table className="w-full border-x border-b border-foreground/80 border-collapse">
          <thead>
            <tr className="border-b border-foreground/80 bg-muted/30 text-[11px]">
              <th className="border-r border-foreground/80 px-1 py-1 w-8">Sl</th>
              <th className="border-r border-foreground/80 px-2 py-1 text-left">
                Description of Services
              </th>
              <th className="border-r border-foreground/80 px-1 py-1 w-16">HSN/SAC</th>
              <th className="border-r border-foreground/80 px-1 py-1 w-12">GST</th>
              <th className="border-r border-foreground/80 px-1 py-1 w-10">Qty</th>
              <th className="border-r border-foreground/80 px-2 py-1 w-20 text-right">Rate</th>
              <th className="px-2 py-1 w-24 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                rowSpan={rowSpanCount}
                className="border-r border-foreground/80 text-center align-top py-1"
              >
                1
              </td>
              <td className="px-2 py-1 font-bold">{serviceTitle}</td>
              <td
                rowSpan={rowSpanCount}
                className="border-l border-r border-foreground/80 text-center align-top py-1"
              >
                {hsnCode}
              </td>
              <td
                rowSpan={rowSpanCount}
                className="border-r border-foreground/80 text-center align-top py-1"
              >
                {invoice.gstPercent}%
              </td>
              <td
                rowSpan={rowSpanCount}
                className="border-r border-foreground/80 text-center align-top py-1"
              >
                {firstItem?.qty ?? 1}
              </td>
              <td className="px-2 py-1 text-right font-bold">{fmt(subtotal)}</td>
              <td className="px-2 py-1 text-right font-bold">{fmt(subtotal)}</td>
            </tr>
            {subItems.map((s, i) => (
              <tr key={i}>
                <td className="px-2 py-0.5">{s.description}</td>
                <td className="px-2 py-0.5 text-right">{fmt(s.amount)}</td>
                <td className="px-2 py-0.5 text-right">{fmt(s.amount)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="py-1"></td>
            </tr>
            {isIgst ? (
              <tr>
                <td className="px-2 py-0.5 text-right italic" colSpan={2}>
                  IGST
                </td>
                <td className="px-2 py-0.5 text-right">{fmt(invoice.igst)}</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td className="px-2 py-0.5 text-right italic" colSpan={2}>
                    CGST
                  </td>
                  <td className="px-2 py-0.5 text-right">{fmt(invoice.cgst)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-0.5 text-right italic" colSpan={2}>
                    SGST
                  </td>
                  <td className="px-2 py-0.5 text-right">{fmt(invoice.sgst)}</td>
                </tr>
              </>
            )}
            {roundOff !== 0 && (
              <tr>
                <td className="px-2 py-0.5 text-right italic" colSpan={2}>
                  Round Off
                </td>
                <td className="px-2 py-0.5 text-right">
                  {roundOff < 0 ? `(-) ${fmt(Math.abs(roundOff))}` : fmt(roundOff)}
                </td>
              </tr>
            )}
            <tr className="border-t border-foreground/80 font-bold">
              <td className="px-2 py-1 text-right">Total</td>
              <td className="border-l border-foreground/80 text-center py-1" colSpan={2}>
                1 nos
              </td>
              <td className="px-2 py-1 text-right">₹ {fmt(grandTotal)}</td>
            </tr>
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
              <td className="border border-foreground/80 text-center px-1 py-1">{hsnCode}</td>
              <td className="border border-foreground/80 text-right px-1 py-1">{fmt(subtotal)}</td>
              <td className="border border-foreground/80 text-center px-1 py-1">
                {isIgst ? invoice.gstPercent : halfRate}%
              </td>
              <td className="border border-foreground/80 text-right px-1 py-1">
                {fmt(isIgst ? invoice.igst : halfTax)}
              </td>
              {!isIgst && (
                <>
                  <td className="border border-foreground/80 text-center px-1 py-1">{halfRate}%</td>
                  <td className="border border-foreground/80 text-right px-1 py-1">
                    {fmt(invoice.sgst)}
                  </td>
                </>
              )}
              <td className="border border-foreground/80 text-right px-1 py-1">{fmt(totalTax)}</td>
            </tr>
            <tr className="font-bold">
              <td className="border border-foreground/80 text-center px-1 py-1">Total</td>
              <td className="border border-foreground/80 text-right px-1 py-1">{fmt(subtotal)}</td>
              <td className="border border-foreground/80 px-1 py-1"></td>
              <td className="border border-foreground/80 text-right px-1 py-1">
                {fmt(isIgst ? invoice.igst : halfTax)}
              </td>
              {!isIgst && (
                <>
                  <td className="border border-foreground/80 px-1 py-1"></td>
                  <td className="border border-foreground/80 text-right px-1 py-1">
                    {fmt(invoice.sgst)}
                  </td>
                </>
              )}
              <td className="border border-foreground/80 text-right px-1 py-1">{fmt(totalTax)}</td>
            </tr>
          </tbody>
        </table>

        <p className="px-1 py-2 text-[11px]">
          Tax Amount (in words):{" "}
          <span className="font-bold">{tinyAmountInWords(totalTax)}</span>
        </p>

        {/* Bank */}
        <div className="border border-foreground/80 p-2 mt-1 text-[11px]">
          <p className="font-bold">Company's Bank Details:</p>
          <p>A/c Holder's Name : {company?.bankAccountName || "—"}</p>
          <p>Bank Name : {company?.bankName || "—"}</p>
          <p>A/c No. : {company?.bankAccountNo || "—"}</p>
          <p>Branch &amp; IFS Code : {company?.bankBranchIfsc || "—"}</p>
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
            <p className="font-bold text-right">for {company?.name || "—"}</p>
          </div>
        </div>

        <p className="text-center font-bold mt-2">{JURISDICTION}</p>
        <p className="text-center italic text-[10px] text-muted-foreground">
          This is a Computer Generated Invoice
        </p>
      </Card>
    </>
  );
}
