# Contributing to HerLedger

## Development workflow

1. Fork the repository and create a feature branch.
2. Follow the [local setup](README.md#local-setup) instructions.
3. Make your changes.
4. Run `pnpm typecheck`, `pnpm lint`, and `pnpm test` before committing.
5. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
6. Open a pull request against `main`.

## Commit format

```
type(scope): description

Examples:
feat(sdk): add business registry reads
fix(web): correct wallet disconnect state
chore(repo): update dependencies
test(indexer): cover payment classification
docs(app): improve local setup instructions
```

## Code standards

- TypeScript strict mode — no `any` without explicit justification.
- No secret keys stored anywhere in the codebase.
- No hard-coded contract IDs or RPC URLs — all from environment variables.
- Financial amounts use `bigint` throughout — never `Number` for on-chain values.
- All API routes validate inputs with Zod.
- Blockchain-derived records are immutable after indexing.

## Testing

- Unit tests: `pnpm test`
- Type checking: `pnpm typecheck`
- Formatting: `pnpm format`

## Pull request checklist

- [ ] TypeScript strict mode — no new `any`
- [ ] Tests added or updated
- [ ] No secrets or private keys committed
- [ ] Amounts use `bigint`
- [ ] API inputs validated
- [ ] CI passes
