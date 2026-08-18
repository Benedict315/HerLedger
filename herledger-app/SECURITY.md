# Security

## Scope

HerLedger is an MVP application. It has **not been audited**. Do not use in
production for real financial data without a professional security review.

## Key security properties

- **No private key storage**: The application never requests, stores, or
  transmits Stellar private keys. All transaction signing is performed by
  the user's Freighter wallet extension.

- **No secret key logging**: Application logs never contain private keys,
  session secrets, authentication tokens, or full sensitive request bodies.

- **Server-side secrets**: `DATABASE_URL` and `BETTER_AUTH_SECRET` are
  never exposed to browser code. Only `NEXT_PUBLIC_*` values are client-accessible.

- **Input validation**: All API inputs are validated with Zod. No user-provided
  data bypasses validation.

- **Database integrity**: Blockchain-derived fields (transaction hash, amount,
  sender, recipient) are immutable after indexing. They cannot be modified
  through normal API requests.

- **Authentication separation**: Application authentication (Better Auth) is
  separate from wallet connection (Freighter). Wallet connection alone does not
  grant application access.

- **Wallet address trust**: Typed wallet addresses are not trusted as proof
  of ownership. On-chain authorization via Soroban contract calls enforces
  actual ownership.

- **Secure session cookies**: Application sessions use secure HTTP-only cookies.

- **No SQL injection**: All database access uses Prisma's parameterized queries.

- **CSRF protection on auth endpoints**: Better Auth (1.6.x) has no `csrf`
  config flag — its CSRF protection is the Origin/Referer + Fetch Metadata
  check built into its origin-check middleware
  (`formCsrfMiddleware`/`validateOrigin`), and it is applied to
  `/api/auth/sign-in/email` and `/api/auth/sign-up/email` by default. It
  rejects two attack shapes: a cross-site top-level form navigation (the
  browser's own `Sec-Fetch-Site: cross-site` + `Sec-Fetch-Mode: navigate`
  headers, which an attacker page cannot forge, trigger an immediate
  reject) and any other cross-origin request whose `Origin`/`Referer`
  doesn't match `trustedOrigins` (currently `[APP_URL]`).

  One caveat we found and closed: Better Auth auto-disables this check
  whenever `NODE_ENV === "test"` (a testing convenience) — which is
  exactly what CI sets for the whole job. `apps/web/lib/auth/server.ts`
  sets `advanced: { disableOriginCheck: false }` explicitly so a `test`
  `NODE_ENV` can never silently turn the protection off, in CI or
  otherwise. Covered by `apps/web/lib/auth/__tests__/server.csrf.test.ts`.

- **User enumeration resistance on sign-in**: every credential-failure path
  in Better Auth's `signInEmail` (unknown email, no credential account,
  wrong password) already normalizes to the same message
  ("Invalid email or password") server-side and performs a dummy password
  hash on the "not found" path so response timing doesn't distinguish it
  from a wrong-password attempt. `apps/web/lib/auth/messages.ts` adds a
  defensive client-side normalization layer on top, so the sign-in form
  never surfaces a different message verbatim even if a future plugin,
  misconfiguration, or upstream change makes one path more specific than
  another.

## Stellar transaction visibility

Stellar transactions are publicly visible on the blockchain. HerLedger does
not claim otherwise. The application minimizes additional personal information
stored on-chain by committing only cryptographic hashes.

## Reporting vulnerabilities

If you discover a security vulnerability, please do not open a public issue.
Contact the maintainers privately at the email listed in the repository.

Provide:
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Any suggested remediation

We will acknowledge receipt within 48 hours and aim to address critical
vulnerabilities within 14 days.

## Known limitations

- No production security audit has been performed.
- No penetration testing has been conducted.
- Smart contract security relies on the `herledger-contract` audit status.
- This application handles financial history records — treat as financial
  infrastructure and conduct appropriate due diligence before real-value
  deployment.
