export function calcGst(subtotal: number, gstPercent: number, gstType: "CGST_SGST" | "IGST") {
  const tax = +(subtotal * (gstPercent / 100)).toFixed(2);
  const rawTotal = +(subtotal + tax).toFixed(2);
  const rounded = Math.round(rawTotal);
  const roundOff = +(rounded - rawTotal).toFixed(2);
  if (gstType === "IGST") {
    return { cgst: 0, sgst: 0, igst: tax, roundOff, total: rounded };
  }
  const half = +(tax / 2).toFixed(2);
  return { cgst: half, sgst: half, igst: 0, roundOff, total: rounded };
}

const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ones[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return tens[t] + (o ? " " + ones[o] : "");
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return (h ? ones[h] + " Hundred" + (r ? " " : "") : "") + (r ? twoDigits(r) : "");
}

export function numberToWordsIndian(num: number): string {
  if (!isFinite(num)) return "";
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;

  if (crore) parts.push(twoDigits(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (hundred) parts.push(threeDigits(hundred));

  let result = parts.join(" ").trim() + " Rupees";
  if (paise > 0) result += " and " + twoDigits(paise) + " Paise";
  return result + " Only";
}
