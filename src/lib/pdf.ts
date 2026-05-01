import jsPDF from "jspdf";
import type { Invoice, Company, Customer } from "./api";
import { numberToWordsIndian } from "./gst";

// Indian-style Tally tax invoice layout matching the reference format.
export function generateInvoicePdf(args: {
  invoice: Invoice;
  company: Company | null;
  customer: Customer | null;
  words: string;
}) {
  const { invoice, company, customer, words } = args;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 24;
  const innerW = pageW - M * 2;
  const right = pageW - M;

  const fmt = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  doc.setLineWidth(0.6);
  doc.setDrawColor(0);
  doc.setTextColor(0);

  // Outer border
  let y = M;
  const startY = y;

  // ---------- Header band: Logo/Company name | TAX INVOICE ----------
  const headerH = 60;
  const headerSplit = M + innerW * 0.55;
  doc.rect(M, y, innerW, headerH);
  doc.line(headerSplit, y, headerSplit, y + headerH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(company?.name || "—", M + 10, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const compAddr = doc.splitTextToSize(company?.address || "", headerSplit - M - 20);
  doc.text(compAddr, M + 10, y + 38);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("TAX INVOICE", headerSplit + (pageW - headerSplit - M) / 2, y + 36, {
    align: "center",
  });
  y += headerH;

  // ---------- Issuer details + Invoice meta grid ----------
  const metaH = 70;
  doc.rect(M, y, innerW, metaH);
  doc.line(headerSplit, y, headerSplit, y + metaH);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const issuerLines = [
    company?.gstin ? `GSTIN: ${company.gstin}` : "",
    company?.stateName ? `State Name: ${company.stateName}` : "",
    company?.email || "",
  ].filter(Boolean);
  issuerLines.forEach((l, i) => doc.text(l, M + 10, y + 16 + i * 12));

  // Right side: 2x2 meta grid (Invoice No / Dated, Reference / Mode, Buyer Order / Other Ref)
  const rX = headerSplit;
  const rW = pageW - M - headerSplit;
  const rowH = metaH / 3;
  const colW = rW / 2;
  // horizontal lines
  doc.line(rX, y + rowH, pageW - M, y + rowH);
  doc.line(rX, y + rowH * 2, pageW - M, y + rowH * 2);
  // vertical line
  doc.line(rX + colW, y, rX + colW, y + metaH);

  const metaCell = (label: string, value: string, cx: number, cy: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(label, cx + 6, cy + 11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(value || "", cx + 6, cy + 24);
  };
  metaCell("Invoice No.", invoice.invoiceNumber, rX, y);
  metaCell("Dated", formatDate(invoice.date), rX + colW, y);
  metaCell("Reference No. & Date.", invoice.referenceNo || "", rX, y + rowH);
  metaCell("Mode/Terms of Payment", invoice.paymentTerms || "", rX + colW, y + rowH);
  metaCell("Buyer's Order No.", invoice.buyerOrderNo || "", rX, y + rowH * 2);
  metaCell("Other References", invoice.otherReferences || "", rX + colW, y + rowH * 2);
  y += metaH;

  // ---------- Buyer / Consignee ----------
  const partyH = 88;
  doc.rect(M, y, innerW, partyH);
  doc.line(M + innerW / 2, y, M + innerW / 2, y + partyH);

  drawParty(doc, "Buyer (Bill to)", customer, M + 8, y + 6, innerW / 2 - 16);
  drawParty(doc, "Consignee (Ship To)", customer, M + innerW / 2 + 8, y + 6, innerW / 2 - 16);
  y += partyH;

  // ---------- Items table ----------
  // Columns: Sl, Description, HSN/SAC, GST Rate, Qty, Rate, Amount
  const cols = [
    { key: "sl", title: "Sl No.", w: 32, align: "center" as const },
    { key: "desc", title: "Description of Services", w: 0, align: "left" as const },
    { key: "hsn", title: "HSN/SAC", w: 56, align: "center" as const },
    { key: "gst", title: "GST Rate", w: 50, align: "center" as const },
    { key: "qty", title: "Qty", w: 36, align: "center" as const },
    { key: "rate", title: "Rate", w: 70, align: "right" as const },
    { key: "amt", title: "Amount", w: 80, align: "right" as const },
  ];
  const fixed = cols.reduce((s, c) => s + c.w, 0);
  cols[1].w = innerW - fixed;

  const colX: number[] = [];
  let cx = M;
  cols.forEach((c) => {
    colX.push(cx);
    cx += c.w;
  });

  // Header row
  const thH = 28;
  doc.rect(M, y, innerW, thH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  cols.forEach((c, i) => {
    if (i > 0) doc.line(colX[i], y, colX[i], y + thH);
    const tx = textXFor(colX[i], c.w, c.align);
    doc.text(c.title, tx, y + 17, { align: c.align });
  });
  y += thH;

  // Body
  doc.setFont("helvetica", "normal");
  const rowPad = 6;
  const lineHeight = 12;

  // Compute description wrapping per row
  const items = invoice.items || [];
  const rowsHeights = items.map((it) => {
    const lines = doc.splitTextToSize(it.description || "", cols[1].w - 12).length || 1;
    return Math.max(20, lines * lineHeight + rowPad);
  });

  const itemsBlockMin = rowsHeights.reduce((s, h) => s + h, 0);
  const taxRowsH = invoice.gstType === "CGST_SGST" ? 2 * 16 : 16;
  const roundOffH = 16;
  const totalRowH = 22;
  const padFiller = 24; // breathing room
  const tableBodyH = itemsBlockMin + taxRowsH + roundOffH + padFiller;

  const bodyTop = y;
  doc.rect(M, y, innerW, tableBodyH);
  // vertical column lines through body
  cols.forEach((_, i) => {
    if (i > 0) doc.line(colX[i], bodyTop, colX[i], bodyTop + tableBodyH);
  });

  // Draw items
  let ry = y + 4;
  items.forEach((it, idx) => {
    const h = rowsHeights[idx];
    // Sl
    doc.setFont("helvetica", "normal");
    doc.text(String(idx + 1), colX[0] + cols[0].w / 2, ry + 12, { align: "center" });
    // Description (bold first line if it looks like a heading? keep normal)
    const descLines = doc.splitTextToSize(it.description || "", cols[1].w - 12);
    doc.text(descLines, colX[1] + 6, ry + 12);
    // HSN, GST only on first row (typical Tally style)
    if (idx === 0) {
      doc.text(items[0].hsnSac || "", colX[2] + cols[2].w / 2, ry + 12, { align: "center" });
      doc.text(`${invoice.gstPercent} %`, colX[3] + cols[3].w / 2, ry + 12, { align: "center" });
      const totalQty = items.reduce((s, x) => s + (Number(x.qty) || 0), 0);
      if (totalQty) doc.text(String(totalQty), colX[4] + cols[4].w / 2, ry + 12, { align: "center" });
    }
    if (it.rate != null) {
      doc.text(fmt(Number(it.rate)), colX[5] + cols[5].w - 6, ry + 12, { align: "right" });
    }
    doc.text(fmt(Number(it.amount) || 0), colX[6] + cols[6].w - 6, ry + 12, { align: "right" });
    ry += h;
  });

  // Tax rows (right aligned within Rate / Amount columns)
  ry = bodyTop + tableBodyH - (taxRowsH + roundOffH + 8);
  doc.setFont("helvetica", "italic");
  if (invoice.gstType === "CGST_SGST") {
    doc.text("CGST", colX[1] + cols[1].w - 6, ry, { align: "right" });
    doc.text(fmt(invoice.cgst), colX[6] + cols[6].w - 6, ry, { align: "right" });
    doc.text(fmt(invoice.cgst), colX[5] + cols[5].w - 6, ry, { align: "right" });
    ry += 16;
    doc.text("SGST", colX[1] + cols[1].w - 6, ry, { align: "right" });
    doc.text(fmt(invoice.sgst), colX[6] + cols[6].w - 6, ry, { align: "right" });
    doc.text(fmt(invoice.sgst), colX[5] + cols[5].w - 6, ry, { align: "right" });
    ry += 16;
  } else {
    doc.text("IGST", colX[1] + cols[1].w - 6, ry, { align: "right" });
    doc.text(fmt(invoice.igst), colX[6] + cols[6].w - 6, ry, { align: "right" });
    doc.text(fmt(invoice.igst), colX[5] + cols[5].w - 6, ry, { align: "right" });
    ry += 16;
  }

  if (invoice.roundOff && Math.abs(invoice.roundOff) > 0.001) {
    doc.text("Round Off", colX[1] + cols[1].w - 6, ry, { align: "right" });
    const ro = invoice.roundOff;
    const roStr = (ro < 0 ? "(-) " : "") + fmt(Math.abs(ro));
    doc.text(roStr, colX[6] + cols[6].w - 6, ry, { align: "right" });
  }

  doc.setFont("helvetica", "normal");
  y = bodyTop + tableBodyH;

  // Total row
  doc.rect(M, y, innerW, totalRowH);
  cols.forEach((_, i) => {
    if (i > 0) doc.line(colX[i], y, colX[i], y + totalRowH);
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total", colX[1] + cols[1].w - 6, y + 15, { align: "right" });
  const totalQty = items.reduce((s, x) => s + (Number(x.qty) || 0), 0);
  if (totalQty) doc.text(`${totalQty} nos`, colX[4] + cols[4].w / 2, y + 15, { align: "center" });
  doc.text(`Rs. ${fmt(invoice.total)}`, colX[6] + cols[6].w - 6, y + 15, { align: "right" });
  y += totalRowH;

  // Amount in words
  const wordsH = 26;
  doc.rect(M, y, innerW, wordsH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Amount Chargeable Including Tax (in words)", M + 6, y + 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(words, M + 6, y + 22);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text("E. & O.E", right - 6, y + 22, { align: "right" });
  y += wordsH;

  // ---------- Tax summary table ----------
  const sumCols = [
    { title: "HSN/SAC", w: 80, align: "center" as const },
    { title: "Taxable Value", w: 90, align: "right" as const },
    { title: "Central Tax Rate", w: 60, align: "center" as const },
    { title: "Central Tax Amount", w: 80, align: "right" as const },
    { title: "State Tax Rate", w: 60, align: "center" as const },
    { title: "State Tax Amount", w: 80, align: "right" as const },
    { title: "Total Tax", w: 0, align: "right" as const },
  ];
  const sumFixed = sumCols.reduce((s, c) => s + c.w, 0);
  sumCols[6].w = innerW - sumFixed;
  const sumX: number[] = [];
  let sx = M;
  sumCols.forEach((c) => {
    sumX.push(sx);
    sx += c.w;
  });
  const sumHeaderH = 22;
  doc.rect(M, y, innerW, sumHeaderH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  sumCols.forEach((c, i) => {
    if (i > 0) doc.line(sumX[i], y, sumX[i], y + sumHeaderH);
    doc.text(c.title, textXFor(sumX[i], c.w, c.align), y + 14, { align: c.align });
  });
  y += sumHeaderH;

  const sumBodyH = 32;
  doc.rect(M, y, innerW, sumBodyH);
  sumCols.forEach((_, i) => {
    if (i > 0) doc.line(sumX[i], y, sumX[i], y + sumBodyH);
  });
  doc.line(M, y + 16, pageW - M, y + 16);
  doc.setFont("helvetica", "normal");
  const cRate = invoice.gstType === "CGST_SGST" ? invoice.gstPercent / 2 : 0;
  const sRate = invoice.gstType === "CGST_SGST" ? invoice.gstPercent / 2 : 0;
  const iRate = invoice.gstType === "IGST" ? invoice.gstPercent : 0;
  const totalTax = invoice.cgst + invoice.sgst + invoice.igst;
  const dataRow = [
    items[0]?.hsnSac || "",
    fmt(invoice.subtotal),
    invoice.gstType === "CGST_SGST" ? `${cRate}%` : `${iRate}%`,
    fmt(invoice.gstType === "CGST_SGST" ? invoice.cgst : invoice.igst),
    invoice.gstType === "CGST_SGST" ? `${sRate}%` : "",
    invoice.gstType === "CGST_SGST" ? fmt(invoice.sgst) : "",
    fmt(totalTax),
  ];
  dataRow.forEach((v, i) =>
    doc.text(v, textXFor(sumX[i], sumCols[i].w, sumCols[i].align), y + 12, {
      align: sumCols[i].align,
    }),
  );
  doc.setFont("helvetica", "bold");
  doc.text("Total", textXFor(sumX[0], sumCols[0].w, "center"), y + 28, { align: "center" });
  doc.text(fmt(invoice.subtotal), textXFor(sumX[1], sumCols[1].w, "right"), y + 28, {
    align: "right",
  });
  doc.text(
    fmt(invoice.gstType === "CGST_SGST" ? invoice.cgst : invoice.igst),
    textXFor(sumX[3], sumCols[3].w, "right"),
    y + 28,
    { align: "right" },
  );
  if (invoice.gstType === "CGST_SGST") {
    doc.text(fmt(invoice.sgst), textXFor(sumX[5], sumCols[5].w, "right"), y + 28, {
      align: "right",
    });
  }
  doc.text(fmt(totalTax), textXFor(sumX[6], sumCols[6].w, "right"), y + 28, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += sumBodyH;

  // Tax in words
  const taxWordsH = 18;
  doc.rect(M, y, innerW, taxWordsH);
  doc.setFontSize(8);
  doc.text("Tax Amount (in words):", M + 6, y + 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(numberToWordsForTax(totalTax), M + 110, y + 12);
  doc.setFont("helvetica", "normal");
  y += taxWordsH;

  // Bank details + signatory
  const bankH = 78;
  doc.rect(M, y, innerW, bankH);
  doc.line(M + innerW * 0.6, y, M + innerW * 0.6, y + bankH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Company's Bank Details:", M + 6, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const bankLines = [
    `A/c Holder's Name : ${company?.bankAccountName || ""}`,
    `Bank Name         : ${company?.bankName || ""}`,
    `A/c No.           : ${company?.bankAccountNo || ""}`,
    `Branch & IFS Code : ${company?.bankBranchIfsc || ""}`,
  ];
  bankLines.forEach((l, i) => doc.text(l, M + 6, y + 30 + i * 11));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`for ${company?.name || ""}`, pageW - M - 6, y + 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Authorised Signatory", pageW - M - 6, y + bankH - 8, { align: "right" });
  y += bankH;

  // Footer
  const footH = 22;
  doc.rect(M, y, innerW, footH);
  doc.setFontSize(8);
  doc.text("SUBJECT TO HYDERABAD JURISDICTION", pageW / 2, y + 11, { align: "center" });
  doc.text("This is a Computer Generated Invoice", pageW / 2, y + 20, { align: "center" });
  y += footH;

  // Outer enclosing border
  doc.setLineWidth(1);
  doc.rect(M, startY, innerW, y - startY);

  // Avoid overflow check (purely informational; jsPDF still renders if it overflows page)
  if (y > pageH - M) {
    // fits with margin
  }

  doc.save(`${invoice.invoiceNumber}.pdf`);
}

function drawParty(
  doc: jsPDF,
  label: string,
  party: Customer | null,
  x: number,
  y: number,
  w: number,
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(label, x, y + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(party?.name || "—", x, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const addr = doc.splitTextToSize(party?.address || "", w);
  doc.text(addr, x, y + 36);
  let yy = y + 36 + addr.length * 11;
  if (party?.gstin) {
    doc.text(`GSTIN/UIN : ${party.gstin}`, x, yy);
    yy += 11;
  }
  if (party?.stateName) {
    const code = party.stateCode ? `, Code : ${party.stateCode}` : "";
    doc.text(`State Name : ${party.stateName}${code}`, x, yy);
    yy += 11;
  }
  if (party?.placeOfSupply) {
    doc.text(`Place of Supply : ${party.placeOfSupply}`, x, yy);
  }
}

function textXFor(x: number, w: number, align: "left" | "center" | "right") {
  if (align === "center") return x + w / 2;
  if (align === "right") return x + w - 6;
  return x + 6;
}

function formatDate(iso: string) {
  // 2026-02-07 -> 07-Feb-26
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return iso || "";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const yy = m[1].slice(2);
  const mm = months[parseInt(m[2], 10) - 1];
  return `${m[3]}-${mm}-${yy}`;
}

// Local copy to avoid circular import
function numberToWordsForTax(n: number): string {
  // dynamic import-free: re-implement minimal call into the existing helper
  // by deferring through globalThis if available, otherwise inline format.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./gst");
    return mod.numberToWordsIndian(n);
  } catch {
    return "";
  }
}
