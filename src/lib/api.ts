// Centralized API client. Set VITE_API_BASE_URL in .env (or in your hosting env)
// to point at your AWS API Gateway HTTP API endpoint.
// Example: VITE_API_BASE_URL=https://abc123.execute-api.ap-south-1.amazonaws.com

const BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  "";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export const userStore = {
  get: () => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  set: (u: unknown) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  // If no backend configured, fall back to a local mock so the UI is usable.
  if (!BASE_URL) {
    return mockApi<T>(path, init);
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, (data && data.message) || res.statusText);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ---------- Endpoint helpers ----------
export type Company = {
  companyId: string;
  name: string;
  address: string;
  gstin: string;
  email: string;
  stateName?: string;
  stateCode?: string;
  bankAccountName?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankBranchIfsc?: string;
};
export type Customer = {
  customerId: string;
  name: string;
  address: string;
  gstin: string;
  stateName?: string;
  stateCode?: string;
  placeOfSupply?: string;
};
export type InvoiceItem = {
  description: string;
  hsnSac?: string;
  qty?: number;
  rate?: number;
  amount: number;
};
export type Invoice = {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  customerName?: string;
  companyId?: string;
  referenceNo?: string;
  paymentTerms?: string;
  buyerOrderNo?: string;
  otherReferences?: string;
  items: InvoiceItem[];
  gstType: "CGST_SGST" | "IGST";
  gstPercent: number;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff?: number;
  total: number;
  status: "PAID" | "PENDING";
};

export type TeamUser = {
  userId: string;
  name: string;
  email: string;
  role: "Admin" | "Manager" | "Staff";
  phone?: string;
  active?: boolean;
};

export const endpoints = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: { email: string; name?: string } }>("/login", {
      email,
      password,
    }),
  listCompanies: () => api.get<Company[]>("/company"),
  saveCompany: (c: Partial<Company>) => api.post<Company>("/company", c),
  listCustomers: () => api.get<Customer[]>("/customer"),
  saveCustomer: (c: Partial<Customer>) => api.post<Customer>("/customer", c),
  listInvoices: () => api.get<Invoice[]>("/invoice"),
  saveInvoice: (inv: Partial<Invoice>) => api.post<Invoice>("/invoice", inv),
  setInvoiceStatus: (invoiceId: string, status: "PAID" | "PENDING") =>
    api.put<Invoice>("/invoice/status", { invoiceId, status }),
  listUsers: () => api.get<TeamUser[]>("/users"),
  saveUser: (u: Partial<TeamUser>) => api.post<TeamUser>("/users", u),
  deleteUser: (userId: string) => api.del<{ ok: true }>(`/users/${userId}`),
};

// ---------- Local mock (used when VITE_API_BASE_URL is empty) ----------
function ls<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function mockApi<T>(path: string, init: RequestInit): Promise<T> {
  await new Promise((r) => setTimeout(r, 150));
  const body = init.body ? JSON.parse(init.body as string) : null;
  const method = init.method || "GET";

  if (path === "/login" && method === "POST") {
    if (!body?.email || !body?.password) throw new ApiError(400, "Missing credentials");
    const ADMIN_EMAIL = "admin_Ayyappa@Apoyphe.com";
    const ADMIN_PASSWORD = "Apoyphe@varaprasad";
    if (
      body.email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase() ||
      body.password !== ADMIN_PASSWORD
    ) {
      throw new ApiError(401, "Invalid email or password");
    }
    return {
      token: "mock-token-" + uid(),
      user: { email: ADMIN_EMAIL, name: "Ayyappa", role: "Admin" },
    } as T;
  }
  if (path === "/company" && method === "GET") return ls<Company[]>("mock_companies", []) as T;
  if (path === "/company" && method === "POST") {
    const list = ls<Company[]>("mock_companies", []);
    const item: Company = { ...body, companyId: body.companyId || uid() };
    const idx = list.findIndex((x) => x.companyId === item.companyId);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    lsSet("mock_companies", list);
    return item as T;
  }
  if (path === "/customer" && method === "GET") return ls<Customer[]>("mock_customers", []) as T;
  if (path === "/customer" && method === "POST") {
    const list = ls<Customer[]>("mock_customers", []);
    const item: Customer = { ...body, customerId: body.customerId || uid() };
    const idx = list.findIndex((x) => x.customerId === item.customerId);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    lsSet("mock_customers", list);
    return item as T;
  }
  if (path === "/invoice" && method === "GET") return ls<Invoice[]>("mock_invoices", []) as T;
  if (path === "/invoice" && method === "POST") {
    const list = ls<Invoice[]>("mock_invoices", []);
    const item: Invoice = { ...body, invoiceId: body.invoiceId || uid() };
    const idx = list.findIndex((x) => x.invoiceId === item.invoiceId);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    lsSet("mock_invoices", list);
    return item as T;
  }
  if (path === "/invoice/status" && method === "PUT") {
    const list = ls<Invoice[]>("mock_invoices", []);
    const idx = list.findIndex((x) => x.invoiceId === body.invoiceId);
    if (idx < 0) throw new ApiError(404, "Invoice not found");
    list[idx].status = body.status;
    lsSet("mock_invoices", list);
    return list[idx] as T;
  }
  if (path === "/users" && method === "GET") return ls<TeamUser[]>("mock_users", []) as T;
  if (path === "/users" && method === "POST") {
    const list = ls<TeamUser[]>("mock_users", []);
    const item: TeamUser = { active: true, ...body, userId: body.userId || uid() };
    const idx = list.findIndex((x) => x.userId === item.userId);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    lsSet("mock_users", list);
    return item as T;
  }
  if (path.startsWith("/users/") && method === "DELETE") {
    const id = path.split("/")[2];
    const list = ls<TeamUser[]>("mock_users", []).filter((x) => x.userId !== id);
    lsSet("mock_users", list);
    return { ok: true } as T;
  }
  throw new ApiError(404, `Mock route not found: ${method} ${path}`);
}
