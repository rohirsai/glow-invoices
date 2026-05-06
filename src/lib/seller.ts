// Default issuer info shown when no Company is saved yet.
export const SELLER = {
  name: "Apoyphe Software Services Pvt Ltd",
  address: "#467, 4th Floor, Ayyappa Society, Madhapur, Hyderabad - 500081.",
  gstin: "36AAXCA4173C1ZI",
  stateName: "Telangana",
  stateCode: "36",
};

export const BANK = {
  accountName: "APOYPHE SOFTWARE SERVICES PRIVATE LIMITED",
  bankName: "ICICI Bank C/Ac",
  accountNo: "424505000618",
  branchAndIfsc: "Kondapur Branch, Sec-Bad. & ICIC0004245",
};

export const TERMS = [
  "Payment due within terms stated above.",
  "Interest @ 18% p.a. on overdue invoices.",
  "Subject to jurisdiction of local courts.",
];

export const JURISDICTION = "SUBJECT TO JURISDICTION";

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);
