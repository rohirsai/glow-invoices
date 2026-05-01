import { endpoints } from "./api";
import { calcGst } from "./gst";

// Seeds the exact reference invoice (APOY/56/25-26 → Sumax Engineering)
// so the user can immediately preview and download a populated PDF.
export async function loadSampleData() {
  // 1. Issuer company — Apoyphe Software Services Pvt Ltd
  const company = await endpoints.saveCompany({
    name: "Apoyphe Software Services Pvt Ltd",
    address: "#467, 4th Floor, Ayyappa Society, Madhapur, Hyderabad - 500081.",
    gstin: "36AAXCA4173C1ZI",
    email: "ramakrishna.venturi@apoyphe.com",
    stateName: "Telangana",
    stateCode: "36",
    bankAccountName: "APOYPHE SOFTWARE SERVICES PRIVATE LIMITED",
    bankName: "ICICI Bank C/Ac",
    bankAccountNo: "424505000618",
    bankBranchIfsc: "Kondapur Branch, Sec-Bad. & ICIC0004245",
  });

  // 2. Customer — Sumax Engineering Limited
  const customer = await endpoints.saveCustomer({
    name: "Sumax Engineering Limited",
    address:
      "45, Shantiniketan Colony, Mahendra Hills,\nEast Marredpally, Secunderabad, Telangana 500026",
    gstin: "36AAECS5500N1Z7",
    stateName: "Telangana",
    stateCode: "36",
    placeOfSupply: "Telangana",
  });

  // 3. Invoice items (taxable values from the reference)
  const items = [
    { description: "AWS-SERVICES", hsnSac: "998315", qty: 1, rate: 68729.84, amount: 68729.84 },
    { description: "Data Transfer & Configuration", hsnSac: "998315", rate: 30728, amount: 30728 },
    { description: "New organisation Set-up", hsnSac: "998315", rate: 6440, amount: 6440 },
    { description: "Manage Services", hsnSac: "998315", rate: 8000, amount: 8000 },
    { description: "Previous Month GST Amount", hsnSac: "998315", rate: 23561.84, amount: 23561.84 },
  ];

  // The reference shows the AWS-SERVICES line as the taxable value (68,729.84)
  // and the rest as informational sub-lines. We mirror that: subtotal = 68,729.84.
  const subtotal = 68729.84;
  const breakdown = calcGst(subtotal, 18, "CGST_SGST");

  await endpoints.saveInvoice({
    invoiceNumber: "APOY/56/25-26",
    date: "2026-02-07",
    customerId: customer.customerId,
    customerName: customer.name,
    companyId: company.companyId,
    referenceNo: "",
    paymentTerms: "",
    buyerOrderNo: "",
    otherReferences: "",
    items,
    gstType: "CGST_SGST",
    gstPercent: 18,
    subtotal,
    ...breakdown,
    status: "PENDING",
  });
}
