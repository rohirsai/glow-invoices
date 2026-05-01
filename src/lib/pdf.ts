import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Invoice, Company, Customer } from "./api";

export function generateInvoicePdf(args: {
  invoice: Invoice;
  company: Company | null;
  customer: Customer | null;
  words: string;
}) {
  const { invoice, company, customer, words } = args;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", pageWidth / 2, margin + 10, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  // From / To
  let y = margin + 40;
  doc.setFont("helvetica", "bold");
  doc.text("From:", margin, y);
  doc.text("To:", pageWidth / 2 + 10, y);
  doc.setFont("helvetica", "normal");
  y += 14;

  const fromLines = [
    company?.name || "—",
    ...(company?.address ? company.address.split("\n") : []),
    company?.gstin ? `GSTIN: ${company.gstin}` : "",
    company?.email || "",
  ].filter(Boolean);
  const toLines = [
    customer?.name || invoice.customerName || "—",
    ...(customer?.address ? customer.address.split("\n") : []),
    customer?.gstin ? `GSTIN: ${customer.gstin}` : "",
  ].filter(Boolean);

  fromLines.forEach((line, i) => doc.text(line, margin, y + i * 12));
  toLines.forEach((line, i) => doc.text(line, pageWidth / 2 + 10, y + i * 12));

  const blockHeight = Math.max(fromLines.length, toLines.length) * 12;
  y += blockHeight + 20;

  // Invoice meta
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, margin, y);
  doc.text(`Date: ${invoice.date}`, pageWidth - margin, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 16;

  // Items table
  autoTable(doc, {
    startY: y,
    head: [["#", "Description", "Amount (Rs.)"]],
    body: invoice.items.map((it, i) => [
      String(i + 1),
      it.description,
      Number(it.amount).toLocaleString("en-IN"),
    ]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: { 0: { cellWidth: 30 }, 2: { halign: "right", cellWidth: 100 } },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error autotable adds lastAutoTable
  let afterTable = (doc.lastAutoTable?.finalY ?? y) + 16;

  // Totals
  const totalsX = pageWidth - margin - 200;
  const valX = pageWidth - margin;
  const line = (label: string, value: number) => {
    doc.text(label, totalsX, afterTable);
    doc.text(`Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`, valX, afterTable, { align: "right" });
    afterTable += 14;
  };
  line("Subtotal", invoice.subtotal);
  if (invoice.gstType === "CGST_SGST") {
    line(`CGST (${invoice.gstPercent / 2}%)`, invoice.cgst);
    line(`SGST (${invoice.gstPercent / 2}%)`, invoice.sgst);
  } else {
    line(`IGST (${invoice.gstPercent}%)`, invoice.igst);
  }
  doc.setFont("helvetica", "bold");
  line("Total", invoice.total);
  doc.setFont("helvetica", "normal");

  afterTable += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  const splitWords = doc.splitTextToSize(`Amount in words: ${words}`, pageWidth - margin * 2);
  doc.text(splitWords, margin, afterTable);

  doc.save(`${invoice.invoiceNumber}.pdf`);
}
