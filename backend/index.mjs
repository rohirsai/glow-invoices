// AWS Lambda handler for the Invoice app.
// Routes match the frontend's src/lib/api.ts exactly:
//   POST   /login
//   GET    /company         POST /company
//   GET    /customer        POST /customer
//   GET    /invoice         POST /invoice
//   PUT    /invoice/status
//   GET    /users           POST /users         DELETE /users/{id}
//
// Storage: DynamoDB. One table per resource (see template.yaml).
// Auth: simple JWT-less bearer token issued at /login (matches the mock).
//       For production, swap to Cognito or verify a real JWT.

import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLES = {
  companies: process.env.COMPANIES_TABLE || "Companies",
  customers: process.env.CUSTOMERS_TABLE || "Customers",
  invoices:  process.env.INVOICES_TABLE  || "Invoices",
  users:     process.env.USERS_TABLE     || "Users",
};

const AUTH_SECRET = process.env.AUTH_SECRET || "change-me-in-production";

// ---------- helpers ----------
const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  },
  body: JSON.stringify(body),
});

const error = (status, message) => json(status, { message });

const parseBody = (event) => {
  if (!event.body) return null;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// Tiny signed token: base64url(payload).hmac
const signToken = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
};

const verifyToken = (token) => {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

const requireAuth = (event) => {
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  return verifyToken(token);
};

// ---------- route handlers ----------

// POST /login
async function login(event) {
  const body = parseBody(event);
  if (!body?.email || !body?.password) return error(400, "Missing credentials");
  // NOTE: replace with real user lookup + password hash check.
  const user = { email: body.email, name: body.email.split("@")[0] };
  const token = signToken({ sub: user.email, iat: Date.now() });
  return json(200, { token, user });
}

// Generic CRUD helpers
async function listAll(table) {
  const out = await ddb.send(new ScanCommand({ TableName: table }));
  return out.Items || [];
}
async function putItem(table, item) {
  await ddb.send(new PutCommand({ TableName: table, Item: item }));
  return item;
}
async function getItem(table, key) {
  const out = await ddb.send(new GetCommand({ TableName: table, Key: key }));
  return out.Item || null;
}
async function deleteItem(table, key) {
  await ddb.send(new DeleteCommand({ TableName: table, Key: key }));
}

// /company
async function handleCompany(event, method) {
  if (method === "GET") return json(200, await listAll(TABLES.companies));
  if (method === "POST") {
    const body = parseBody(event) || {};
    const item = { ...body, companyId: body.companyId || randomUUID() };
    await putItem(TABLES.companies, item);
    return json(200, item);
  }
  return error(405, "Method not allowed");
}

// /customer
async function handleCustomer(event, method) {
  if (method === "GET") return json(200, await listAll(TABLES.customers));
  if (method === "POST") {
    const body = parseBody(event) || {};
    const item = { ...body, customerId: body.customerId || randomUUID() };
    await putItem(TABLES.customers, item);
    return json(200, item);
  }
  return error(405, "Method not allowed");
}

// /invoice and /invoice/status
async function handleInvoice(event, method, path) {
  if (path === "/invoice/status" && method === "PUT") {
    const body = parseBody(event) || {};
    if (!body.invoiceId || !body.status) return error(400, "invoiceId and status required");
    const existing = await getItem(TABLES.invoices, { invoiceId: body.invoiceId });
    if (!existing) return error(404, "Invoice not found");
    const out = await ddb.send(new UpdateCommand({
      TableName: TABLES.invoices,
      Key: { invoiceId: body.invoiceId },
      UpdateExpression: "SET #s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": body.status },
      ReturnValues: "ALL_NEW",
    }));
    return json(200, out.Attributes);
  }
  if (path === "/invoice" && method === "GET") return json(200, await listAll(TABLES.invoices));
  if (path === "/invoice" && method === "POST") {
    const body = parseBody(event) || {};
    const item = { ...body, invoiceId: body.invoiceId || randomUUID() };
    await putItem(TABLES.invoices, item);
    return json(200, item);
  }
  return error(405, "Method not allowed");
}

// /users and /users/{id}
async function handleUsers(event, method, path) {
  if (path === "/users" && method === "GET") return json(200, await listAll(TABLES.users));
  if (path === "/users" && method === "POST") {
    const body = parseBody(event) || {};
    const item = { active: true, ...body, userId: body.userId || randomUUID() };
    await putItem(TABLES.users, item);
    return json(200, item);
  }
  if (path.startsWith("/users/") && method === "DELETE") {
    const id = path.split("/")[2];
    await deleteItem(TABLES.users, { userId: id });
    return json(200, { ok: true });
  }
  return error(405, "Method not allowed");
}

// ---------- Lambda entrypoint ----------
export const handler = async (event) => {
  const method =
    event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = event.rawPath || event.path || "/";

  // CORS preflight
  if (method === "OPTIONS") return json(204, {});

  try {
    if (path === "/login") return await login(event);

    // All other routes require a valid token.
    const user = requireAuth(event);
    if (!user) return error(401, "Unauthorized");

    if (path === "/company") return await handleCompany(event, method);
    if (path === "/customer") return await handleCustomer(event, method);
    if (path === "/invoice" || path === "/invoice/status")
      return await handleInvoice(event, method, path);
    if (path === "/users" || path.startsWith("/users/"))
      return await handleUsers(event, method, path);

    return error(404, `Route not found: ${method} ${path}`);
  } catch (err) {
    console.error("Lambda error:", err);
    return error(500, err.message || "Internal error");
  }
};
