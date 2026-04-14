# Apollo Client POC — Vendure Storefront

A full e-commerce storefront built with **Vendure** (GraphQL backend) and **Apollo Client v4** on the frontend. Used for exploring Apollo cache behaviour with realistic data at scale.

## Repo Structure

```
apollo-client-poc/
├── packages/
│   ├── backend/            # Vendure — Node.js GraphQL server
│   ├── storefront-apollo/  # React 19 + Apollo Client v4
│   └── storefront-relay/   # React 19 + Relay — same UI, different data layer
```

---

## Local Setup

### Prerequisites
- Node.js 20+
- pnpm 9+

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure and start the backend

```bash
cd packages/backend
cp .env.example .env   # edit values if needed (defaults work for local dev)
pnpm dev
```

Vendure starts at `http://localhost:3000`
- Shop API: `http://localhost:3000/shop-api`
- Admin API: `http://localhost:3000/admin-api`
- Admin UI: `http://localhost:3000/admin` (superadmin / superadmin123)

### 3. Seed the database

Run these three scripts **in order** from the repo root. The backend must be running.

```bash
# Creates collections, facets, shipping methods, tax rates, and base products
pnpm --filter backend seed

# Adds ~840 more products (3 price-tiered variants each)
pnpm --filter backend extend-seed

# Brings every sub-collection up to 400 products
pnpm --filter backend fill-to-200
```

After seeding, **restart the backend** so the search index picks up all new products:

```bash
# Ctrl+C the backend, then:
pnpm dev:backend
```

### 4. Start the Apollo storefront

```bash
cd packages/storefront-apollo
cp .env.example .env   # set VITE_VENDURE_SHOP_API_URL if needed (defaults to localhost:3000)
pnpm dev
```

Apollo storefront at `http://localhost:5173`

### 5. Start the Relay storefront

```bash
cd packages/storefront-relay
cp .env.example .env

# Download the schema (backend must be running)
pnpm fetch-schema

# Compile Relay fragments into __generated__ directories
pnpm relay

pnpm dev
```

Relay storefront at `http://localhost:5174` (Vite assigns the next free port)

---

## Simulated Latency

The backend adds an artificial delay to every Shop API response to make loading states visible during development. Controlled via `.env`:

```
SIMULATED_LATENCY_MS=350
```

Set to `0` to disable.

---

## Deployment

### Backend → Render

Connect your repo to Render and point it at `packages/backend/render.yaml`. Render will automatically provision a Postgres database and inject connection details as environment variables. Update `SUPERADMIN_PASSWORD` in the Render dashboard.

### Storefront → Netlify

Connect your repo to Netlify with these settings:
- Base directory: `packages/storefront-apollo`
- Build command: `pnpm build`
- Publish directory: `dist`
- Environment variable: `VITE_VENDURE_SHOP_API_URL` → your Render backend URL

---

## Apollo Cache — Why id-less types matter

Apollo's `InMemoryCache` normalizes objects that have an `id` field — stored once, referenced everywhere. Types **without** `id` fields are stored inline (duplicated) inside each parent's cache entry:

| Type | id field? | Cache behaviour |
|---|---|---|
| `Product`, `ProductVariant`, `Order` | Yes | Normalized — stored once |
| `PriceRange`, `SinglePrice` | No | Inline — duplicated per product |
| `TaxLine` | No | Inline — duplicated per order |
| `ShippingLine` | No | Inline — duplicated per order |
| `Adjustment` | No | Inline — duplicated per line + order |
| `OrderAddress` | No | Inline — duplicated per order |
