# Invoice App — AWS Lambda Backend

Drop-in backend for the frontend in `src/`. Implements every route in `src/lib/api.ts`:

| Method | Path                | Purpose                |
|--------|---------------------|------------------------|
| POST   | `/login`            | Issue auth token       |
| GET    | `/company`          | List companies         |
| POST   | `/company`          | Create / update        |
| GET    | `/customer`         | List customers         |
| POST   | `/customer`         | Create / update        |
| GET    | `/invoice`          | List invoices          |
| POST   | `/invoice`          | Create / update        |
| PUT    | `/invoice/status`   | Toggle PAID / PENDING  |
| GET    | `/users`            | List team users        |
| POST   | `/users`            | Create / update        |
| DELETE | `/users/{id}`       | Delete a user          |

Storage: DynamoDB (one table per resource, all `PAY_PER_REQUEST`).
Auth: HMAC-signed token issued by `/login`. **Replace with Cognito or a real
JWT verification before going to production.**

---

## Deploy with AWS SAM (recommended)

### 1. Install tools (once)
```bash
# macOS
brew install aws-sam-cli awscli
# Windows: download installers from AWS

aws configure        # access key, secret, region (e.g. ap-south-1)
```

### 2. Install dependencies & deploy
```bash
cd backend
npm install
sam build
sam deploy --guided
```

Accept the defaults. When asked for `AuthSecret`, paste a long random string
(e.g. `openssl rand -hex 32`). At the end SAM prints:

```
ApiUrl = https://abc123.execute-api.ap-south-1.amazonaws.com
```

### 3. Wire the frontend to it
In the project root (one level above `backend/`):
```bash
echo "VITE_API_BASE_URL=https://abc123.execute-api.ap-south-1.amazonaws.com" > .env.production
bun install
bun run build
```
Upload the resulting `dist/` to S3 (or any static host). Done.

---

## Deploy via the AWS Console (no CLI)

1. **DynamoDB** → create 4 tables with these names + partition keys (all `String`):
   - `Companies` → `companyId`
   - `Customers` → `customerId`
   - `Invoices`  → `invoiceId`
   - `Users`     → `userId`
2. **Lambda** → Create function → Node.js 20.x → upload a zip of this folder
   (run `npm install` first so `node_modules/` is included).
   - Handler: `index.handler`
   - Env vars: `AUTH_SECRET=<random string>`
   - IAM role: attach `AmazonDynamoDBFullAccess` (or scoped policies).
3. **API Gateway** → Create **HTTP API** → integration: the Lambda above
   → routes: `ANY /{proxy+}` and `ANY /` → deploy → copy the **Invoke URL**.
4. Put the Invoke URL into `.env.production` as shown above and redeploy the
   frontend.

---

## Local test

```bash
cd backend
npm install
sam local start-api          # serves on http://localhost:3000
curl -X POST http://localhost:3000/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","password":"x"}'
```

---

## Notes / production hardening

- Replace the demo `/login` with real user lookup + bcrypt password verification,
  or front the API with **Amazon Cognito** and verify the JWT in `requireAuth`.
- Restrict `Access-Control-Allow-Origin` from `*` to your real domain.
- Add input validation (e.g. `zod`) on every POST/PUT body.
- Consider adding GSIs if you need to query invoices by customer/date.
