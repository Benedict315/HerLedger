# HerLedger Application

HerLedger is a financial-history application for women-owned businesses. It
records recognized Stellar transactions and verified attestations so a
business can build a portable, auditable financial history.

HerLedger **does not** issue loans, calculate credit scores, make lending
decisions, or claim Stellar transactions are private.

---

## Repository structure

```
herledger-app/
├── apps/web/            Next.js 16 frontend (App Router)
├── packages/config/     Typed environment validation (Zod)
├── packages/sdk/        Stellar/Soroban TypeScript SDK
├── indexer/             Transaction indexer + HTTP API (Fastify)
├── prisma/              Database schema and migrations
└── scripts/             Development and build scripts
```

---

## Prerequisites

- Node.js 24.18.0 LTS
- pnpm 9+
- PostgreSQL 16
- Freighter browser extension (for wallet connection)
- Stellar Testnet access

---

## Local setup

### 1. Install dependencies

```sh
cd herledger-app
pnpm install
```

### 2. Configure environment

```sh
cp .env.example apps/web/.env.local
```

Edit `apps/web/.env.local` and fill in:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/herledger
BETTER_AUTH_SECRET=<random 32+ character secret>
APP_URL=http://localhost:3000
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
BUSINESS_REGISTRY_CONTRACT_ID=<deployed contract ID>
FINANCIAL_LEDGER_CONTRACT_ID=<deployed contract ID>
ATTESTATION_REGISTRY_CONTRACT_ID=<deployed contract ID>
INDEXER_API_URL=http://localhost:4000
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_BUSINESS_REGISTRY_CONTRACT_ID=<deployed contract ID>
NEXT_PUBLIC_FINANCIAL_LEDGER_CONTRACT_ID=<deployed contract ID>
NEXT_PUBLIC_ATTESTATION_REGISTRY_CONTRACT_ID=<deployed contract ID>
```

Contract IDs are populated after deploying the `herledger-contract` workspace.
**Never invent contract IDs.**

### 3. Set up the database

```sh
pnpm db:generate
pnpm db:migrate:dev
```

### 4. Start development

```sh
bash scripts/dev.sh
```

Or individually:

```sh
# Web app
pnpm --filter web dev

# Indexer
pnpm --filter indexer dev
```

---

## Build

```sh
pnpm build
```

---

## Tests

```sh
pnpm test
```

---

## Deployment

### Frontend (Vercel / Next.js-native platform)

- **Root directory**: `herledger-app/apps/web`
- **Build command**: `pnpm --filter web build`
- **Start command**: `pnpm --filter web start`
- Set all environment variables from `.env.example` in Vercel dashboard.
- `NEXT_PUBLIC_*` variables are safe for browser exposure.
- Never expose `DATABASE_URL` or `BETTER_AUTH_SECRET` as `NEXT_PUBLIC_*`.

### Indexer (Render / long-running service)

- **Root directory**: `herledger-app/indexer`
- **Build command**: `pnpm --filter indexer build`
- **Start command**: `pnpm --filter indexer start`

### Database

Run migrations before starting the indexer or web app in production:

```sh
pnpm db:migrate
```

---

## Contract integration

After deploying the Soroban contracts from `herledger-contract/`:

1. Copy the deployed contract IDs from the deployment output.
2. Set `BUSINESS_REGISTRY_CONTRACT_ID`, `FINANCIAL_LEDGER_CONTRACT_ID`, and
   `ATTESTATION_REGISTRY_CONTRACT_ID` in your environment files.
3. Set the corresponding `NEXT_PUBLIC_*` versions for browser-accessible reads.
4. Restart the indexer and web app.

The application will fail at startup with a descriptive error if contract IDs
are missing.

---

## Architecture

```
User
 │
 ├─► Next.js frontend
 │     ├─► Better Auth (application authentication)
 │     ├─► Freighter (Stellar wallet signing)
 │     └─► Soroban RPC (contract writes via user's wallet)
 │
 └─► Indexer API
       └─► PostgreSQL
             ◄─── Indexer (observes Stellar network)
```

The user's wallet signs all contract write transactions. The application
backend never holds or uses private keys.

---

## Security

See [SECURITY.md](SECURITY.md).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
