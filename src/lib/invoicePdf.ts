import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import logoUrl from "@/assets/apoyphe-logo-black.png";
import type { Invoice, Company, Customer } from "@/lib/api";
import { numberToWordsIndian } from "@/lib/gst";

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

const tinyAmountInWords = (n: number, currency = "INR") => {
  const words = numberToWordsIndian(Math.abs(n))
    .replace(" Rupees", " Rupee")
    .replace(" Paise", " Paisa");
  return `${currency} ${words}.`;
};

const TERMS = [
  "Payment due within terms stated above.",
  "Interest @ 18% p.a. on overdue invoices.",
  "Subject to jurisdiction of local courts.",
];
const JURISDICTION = "SUBJECT TO JURISDICTION";

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const BORDER = 0.6;
const INK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [82, 82, 91];
const HEAD_BG: [number, number, number] = [244, 244, 245];

export async function generateInvoicePdf(
  invoice: Invoice,
  company: Company | null,
  customer: Customer,
) {
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 28;
  const contentW = pageW - margin * 2;

  const isIgst = invoice.gstType === "IGST";
  const subtotal = invoice.subtotal;
  const halfRate = invoice.gstPercent / 2;
  const totalTax = isIgst ? invoice.igst : invoice.cgst + invoice.sgst;
  const roundOff = invoice.roundOff ?? 0;
  const grandTotal = invoice.total;
  const firstItem = invoice.items[0];
  const hsnCode = firstItem?.hsnSac || "—";
  const serviceTitle = firstItem?.description || "Services rendered";
  const subItems = invoice.items.slice(1);
  const placeOfSupply = customer.placeOfSupply || customer.stateName || company?.stateName || "";
  const stateCode = customer.stateCode || company?.stateCode || "—";

  pdf.setTextColor(...INK);
  pdf.setDrawColor(...INK);

  // Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("TAX INVOICE", pageW / 2, margin + 14, { align: "center" });

  let y = margin + 24;

  // ===== Header: company (left) + invoice meta (right grid) =====
  const leftW = contentW * 0.55;
  const rightW = contentW - leftW;
  const headerH = 96;

  // Outer box
  pdf.setLineWidth(BORDER);
  pdf.rect(margin, y, contentW, headerH);
  pdf.line(margin + leftW, y, margin + leftW, y + headerH);

  // Logo + company
  const logoData = await loadLogoDataUrl();
  let textX = margin + 8;
  if (logoData) {
    try {
      pdf.addImage(logoData, "PNG", margin + 6, y + 6, 40, 40);
      textX = margin + 54;
    } catch {
      /* ignore */
    }
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(company?.name || "—", textX, y + 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  const companyLines: string[] = [];
  if (company?.address) companyLines.push(...company.address.split("\n"));
  if (company?.gstin) companyLines.push(`GSTIN: ${company.gstin}`);
  if (company?.stateName || company?.stateCode)
    companyLines.push(
      `State Name: ${company?.stateName || "—"}, Code: ${company?.stateCode || "—"}`,
    );
  let cy = y + 26;
  for (const line of companyLines) {
    const wrapped = pdf.splitTextToSize(line, leftW - (textX - margin) - 6);
    for (const w of wrapped) {
      pdf.text(w, textX, cy);
      cy += 10;
    }
  }

  // Right meta grid 2 cols x 3 rows
  const metaCols = 2;
  const metaRows = 3;
  const cellW = rightW / metaCols;
  const cellH = headerH / metaRows;
  const meta: Array<[string, string]> = [
    ["Invoice No.", invoice.invoiceNumber],
    ["Dated", fmtDate(invoice.date)],
    ["Reference No. & Date", invoice.referenceNo || "—"],
    ["Mode/Terms of Payment", invoice.paymentTerms || "—"],
    ["Buyer's Order No.", invoice.buyerOrderNo || "—"],
    ["Other References", invoice.otherReferences || invoice.status],
  ];
  for (let i = 0; i < meta.length; i++) {
    const r = Math.floor(i / metaCols);
    const c = i % metaCols;
    const cx = margin + leftW + c * cellW;
    const cy2 = y + r * cellH;
    if (c > 0) pdf.line(cx, cy2, cx, cy2 + cellH);
    if (r > 0) pdf.line(cx, cy2, cx + cellW, cy2);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(meta[i][0], cx + 4, cy2 + 10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...INK);
    const valLines = pdf.splitTextToSize(String(meta[i][1] ?? "—"), cellW - 8);
    pdf.text(valLines, cx + 4, cy2 + 22);
  }

  y += headerH;

  // ===== Buyer / Consignee =====
  const bcH = 92;
  pdf.rect(margin, y, contentW, bcH);
  pdf.line(margin + contentW / 2, y, margin + contentW / 2, y + bcH);

  const drawParty = (title: string, x: number) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(title, x + 6, y + 10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    pdf.text(customer.name, x + 6, y + 22);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    let py = y + 32;
    const addrLines = (customer.address || "").split("\n");
    for (const line of addrLines) {
      const wrapped = pdf.splitTextToSize(line, contentW / 2 - 12);
      for (const w of wrapped) {
        pdf.text(w, x + 6, py);
        py += 10;
      }
    }
    if (customer.gstin) {
      pdf.text(`GSTIN/UIN: ${customer.gstin}`, x + 6, py);
      py += 10;
    }
    pdf.text(`State Name: ${placeOfSupply || "—"}, Code: ${stateCode}`, x + 6, py);
    py += 10;
    pdf.text(`Place of Supply: ${placeOfSupply || "—"}`, x + 6, py);
  };
  drawParty("Buyer (Bill to)", margin);
  drawParty("Consignee (Ship to)", margin + contentW / 2);

  y += bcH;

  // ===== Items table (autoTable) =====
  // Column widths sum to contentW
  const cw = {
    sl: 26,
    desc: 0,
    hsn: 60,
    gst: 42,
    qty: 36,
    rate: 78,
    amount: 86,
  };
  cw.desc = contentW - (cw.sl + cw.hsn + cw.gst + cw.qty + cw.rate + cw.amount);

  type Row = RowInput;
  const body: Row[] = [];

  // First row: bold service title with Sl/HSN/GST/Qty spanning the section
  body.push([
    { content: "1", rowSpan: 1 + subItems.length + 1 + (isIgst ? 1 : 2) + (roundOff ? 1 : 0) },
    { content: serviceTitle, styles: { fontStyle: "bold" } },
    { content: hsnCode, rowSpan: 1 + subItems.length + 1 + (isIgst ? 1 : 2) + (roundOff ? 1 : 0) },
    {
      content: `${invoice.gstPercent}%`,
      rowSpan: 1 + subItems.length + 1 + (isIgst ? 1 : 2) + (roundOff ? 1 : 0),
    },
    {
      content: String(firstItem?.qty ?? 1),
      rowSpan: 1 + subItems.length + 1 + (isIgst ? 1 : 2) + (roundOff ? 1 : 0),
    },
    { content: fmt(subtotal), styles: { halign: "right", fontStyle: "bold" } },
    { content: fmt(subtotal), styles: { halign: "right", fontStyle: "bold" } },
  ]);

  // Sub-items (description + amount + amount)
  for (const s of subItems) {
    body.push([
      s.description,
      { content: fmt(s.amount), styles: { halign: "right" } },
      { content: fmt(s.amount), styles: { halign: "right" } },
    ]);
  }

  // Spacer row
  body.push([{ content: " ", colSpan: 3 }]);

  // Tax rows
  if (isIgst) {
    body.push([
      { content: "IGST", colSpan: 2, styles: { halign: "right", fontStyle: "italic" } },
      { content: fmt(invoice.igst), styles: { halign: "right" } },
    ]);
  } else {
    body.push([
      { content: "CGST", colSpan: 2, styles: { halign: "right", fontStyle: "italic" } },
      { content: fmt(invoice.cgst), styles: { halign: "right" } },
    ]);
    body.push([
      { content: "SGST", colSpan: 2, styles: { halign: "right", fontStyle: "italic" } },
      { content: fmt(invoice.sgst), styles: { halign: "right" } },
    ]);
  }

  if (roundOff) {
    body.push([
      { content: "Round Off", colSpan: 2, styles: { halign: "right", fontStyle: "italic" } },
      {
        content:
          roundOff < 0 ? `(-) ${fmt(Math.abs(roundOff))}` : fmt(roundOff),
        styles: { halign: "right" },
      },
    ]);
  }

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3,
      lineColor: INK,
      lineWidth: BORDER,
      textColor: INK,
      valign: "top",
    },
    headStyles: {
      fillColor: HEAD_BG,
      textColor: INK,
      fontStyle: "bold",
      halign: "center",
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: cw.sl, halign: "center" },
      1: { cellWidth: cw.desc },
      2: { cellWidth: cw.hsn, halign: "center" },
      3: { cellWidth: cw.gst, halign: "center" },
      4: { cellWidth: cw.qty, halign: "center" },
      5: { cellWidth: cw.rate, halign: "right" },
      6: { cellWidth: cw.amount, halign: "right" },
    },
    head: [["Sl", "Description of Services", "HSN/SAC", "GST", "Qty", "Rate", "Amount"]],
    body,
    foot: [
      [
        { content: "Total", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
        { content: `${firstItem?.qty ?? 1} nos`, styles: { halign: "center", fontStyle: "bold" } },
        { content: "", styles: {} },
        { content: `₹ ${fmt(grandTotal)}`, styles: { halign: "right", fontStyle: "bold" } },
      ],
    ],
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: INK,
      lineColor: INK,
      lineWidth: BORDER,
    },
  });

  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Amount in words box
  const wordsH = 36;
  pdf.rect(margin, y, contentW, wordsH);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Amount Chargeable Including Tax (in words)", margin + 6, y + 11);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  const wordsLines = pdf.splitTextToSize(tinyAmountInWords(grandTotal), contentW - 60);
  pdf.text(wordsLines, margin + 6, y + 23);
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...MUTED);
  pdf.text("E. & O.E", margin + contentW - 6, y + 30, { align: "right" });
  pdf.setTextColor(...INK);

  y += wordsH;

  // ===== HSN Tax Summary =====
  const hsnHead: RowInput[] = isIgst
    ? [
        [
          { content: "HSN/SAC", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
          { content: "Taxable Value", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
          { content: "Integrated Tax", colSpan: 2, styles: { halign: "center" } },
          { content: "Total Tax", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
        ],
        [
          { content: "Rate", styles: { halign: "center" } },
          { content: "Amount", styles: { halign: "center" } },
        ],
      ]
    : [
        [
          { content: "HSN/SAC", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
          { content: "Taxable Value", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
          { content: "Central Tax", colSpan: 2, styles: { halign: "center" } },
          { content: "State Tax", colSpan: 2, styles: { halign: "center" } },
          { content: "Total Tax", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
        ],
        [
          { content: "Rate", styles: { halign: "center" } },
          { content: "Amount", styles: { halign: "center" } },
          { content: "Rate", styles: { halign: "center" } },
          { content: "Amount", styles: { halign: "center" } },
        ],
      ];

  const hsnBody: RowInput[] = isIgst
    ? [
        [
          { content: hsnCode, styles: { halign: "center" } },
          { content: fmt(subtotal), styles: { halign: "right" } },
          { content: `${invoice.gstPercent}%`, styles: { halign: "center" } },
          { content: fmt(invoice.igst), styles: { halign: "right" } },
          { content: fmt(totalTax), styles: { halign: "right" } },
        ],
        [
          { content: "Total", styles: { halign: "center", fontStyle: "bold" } },
          { content: fmt(subtotal), styles: { halign: "right", fontStyle: "bold" } },
          { content: "", styles: {} },
          { content: fmt(invoice.igst), styles: { halign: "right", fontStyle: "bold" } },
          { content: fmt(totalTax), styles: { halign: "right", fontStyle: "bold" } },
        ],
      ]
    : [
        [
          { content: hsnCode, styles: { halign: "center" } },
          { content: fmt(subtotal), styles: { halign: "right" } },
          { content: `${halfRate}%`, styles: { halign: "center" } },
          { content: fmt(invoice.cgst), styles: { halign: "right" } },
          { content: `${halfRate}%`, styles: { halign: "center" } },
          { content: fmt(invoice.sgst), styles: { halign: "right" } },
          { content: fmt(totalTax), styles: { halign: "right" } },
        ],
        [
          { content: "Total", styles: { halign: "center", fontStyle: "bold" } },
          { content: fmt(subtotal), styles: { halign: "right", fontStyle: "bold" } },
          { content: "", styles: {} },
          { content: fmt(invoice.cgst), styles: { halign: "right", fontStyle: "bold" } },
          { content: "", styles: {} },
          { content: fmt(invoice.sgst), styles: { halign: "right", fontStyle: "bold" } },
          { content: fmt(totalTax), styles: { halign: "right", fontStyle: "bold" } },
        ],
      ];

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 3,
      lineColor: INK,
      lineWidth: BORDER,
      textColor: INK,
      valign: "middle",
    },
    headStyles: {
      fillColor: HEAD_BG,
      textColor: INK,
      fontStyle: "bold",
      halign: "center",
    },
    head: hsnHead,
    body: hsnBody,
  });

  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text("Tax Amount (in words):", margin, y + 8);
  pdf.setFont("helvetica", "bold");
  pdf.text(tinyAmountInWords(totalTax), margin + 96, y + 8);
  y += 16;

  // Bank box
  const bankH = 60;
  pdf.rect(margin, y, contentW, bankH);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("Company's Bank Details:", margin + 6, y + 11);
  pdf.setFont("helvetica", "normal");
  const bankLines = [
    `A/c Holder's Name : ${company?.bankAccountName || "—"}`,
    `Bank Name : ${company?.bankName || "—"}`,
    `A/c No. : ${company?.bankAccountNo || "—"}`,
    `Branch & IFS Code : ${company?.bankBranchIfsc || "—"}`,
  ];
  let by = y + 22;
  for (const line of bankLines) {
    pdf.text(line, margin + 6, by);
    by += 10;
  }
  y += bankH;

  // Terms + signatory
  const termsH = 70;
  pdf.rect(margin, y, contentW, termsH);
  pdf.line(margin + contentW / 2, y, margin + contentW / 2, y + termsH);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("Terms and Conditions:", margin + 6, y + 11);
  pdf.setFont("helvetica", "normal");
  let ty = y + 22;
  TERMS.forEach((t, i) => {
    const wrapped = pdf.splitTextToSize(`${i + 1}. ${t}`, contentW / 2 - 12);
    for (const w of wrapped) {
      pdf.text(w, margin + 6, ty);
      ty += 10;
    }
  });
  pdf.setFont("helvetica", "bold");
  pdf.text(`for ${company?.name || "—"}`, margin + contentW - 6, y + 14, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Authorised Signatory", margin + contentW - 6, y + termsH - 8, { align: "right" });

  y += termsH + 10;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(JURISDICTION, pageW / 2, y, { align: "center" });
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...MUTED);
  pdf.text("This is a Computer Generated Invoice", pageW / 2, y + 10, { align: "center" });

  pdf.save(`${invoice.invoiceNumber}.pdf`);
}
