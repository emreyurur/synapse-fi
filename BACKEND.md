# SynapseFi Backend (Faz 2)

Indexer, scoring, oracle worker, and REST API. All TypeScript, single schema
source of truth: the Ponder indexer writes Postgres tables that the API reads.

```
packages/indexer/   Ponder — indexes chain events → Postgres
packages/shared/    scoring formula (0–100, versioned) + ABIs + addresses
apps/api/           Hono REST API + scoring service + oracle worker + traffic gen
```

## Data flow

```
MockJobBoard (ERC-8183)  ─┐
ScoreOracle / Pool / CLM ─┼─▶ Ponder indexer ─▶ Postgres ─▶ Hono API ─▶ frontend
RevenueSplitter (factory)─┘                          ▲
                                                     │
                          Oracle worker ──▶ ScoreOracle.setScores (0–100 ×10)
                          (reads DB, computes score, writes chain each epoch)
```

## Scoring (0–100)

`packages/shared/src/scoring.ts` — the single, versioned formula. Four factors,
each normalized to 0–100, weighted into a 0–100 credit score + letter grade:

| Factor | Weight | Source |
|---|---|---|
| Job completion rate | 0.30 | completed / accepted jobs |
| Revenue continuity | 0.25 | active days in the 30-day window |
| Dispute-free rate | 0.25 | 1 − disputes / completed |
| Revenue stability | 0.20 | 1 − CV(daily revenue) |

The on-chain `ScoreOracle` stores 0–1000, so the oracle worker writes
`score × 10` (`toOnchainScore`). Bump `SCORING_VERSION` when weights change —
it feeds the on-chain `factorsHash` so the breakdown stays reproducible.

## Run it

```bash
# 1. Indexer (needs deployed contract addresses; see packages/indexer/.env.example)
npm run dev:indexer            # ponder dev — uses embedded PGlite by default

# 2. API (reads the same DB; see apps/api/.env.example)
npm run dev:api                # http://localhost:3001

# 3. Oracle worker — one epoch now (dry-run without ORACLE_PRIVATE_KEY)
npm run oracle

# 4. Synthetic traffic — demo jobs + nanopayments on MockJobBoard
TRAFFIC_POSTER_KEY=0x... TRAFFIC_AGENT_KEYS=0x...,0x... npm run traffic -- --rounds 20
```

For a shared Postgres (so the API sees indexed rows), set the same
`DATABASE_URL` in both `packages/indexer/.env` and `apps/api/.env`, and run
`ponder start` with `DATABASE_SCHEMA=public`.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/agents` | agent list, best score first (0–100) |
| GET | `/agents/:id` | full breakdown: factors, line, revenue series, history |
| GET | `/agents/:id/payments` | routed payment history (`?limit=`) |
| POST | `/agents/:address/onboard` | MVP demo onboarding — see below |
| GET | `/pool/stats` | TVL, utilization, borrow APR, supply APY, default rate |

Responses are cached (`CACHE_TTL_MS`, default 15s) and rate-limited
(`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`). `/pool/stats` prefers live on-chain
reads and falls back to indexed counters (`source: "chain" | "indexer"`).

## MVP demo onboarding

A wallet with no ERC-8183 job/revenue history reads a `0` score and `0` credit
limit straight from the contracts — `CreditLineManager.creditLimit()` is a
direct function of `ScoreOracle.getScore()`, so there's nothing to open a line
against. For a hackathon demo where any judge's wallet needs to try Borrow
immediately, `POST /agents/:address/onboard` (`apps/api/src/oracle/mock-score.ts`)
writes a deterministic score (600–899 on-chain, i.e. 60–89 canonical) for that
address using the same authorized-updater key the epoch worker uses
(`ORACLE_PRIVATE_KEY` / `SCORE_ORACLE_ADDRESS`). It's a real `ScoreOracle.setScore`
transaction — `openLine`/`draw` work against it exactly like an organic epoch
score — not a frontend-only fake. It's a no-op once an address has any fresh
score. The web app calls it automatically the first time a connected wallet
reads a `0` limit (`apps/web/src/components/borrow-view.tsx`).

Earn needs no onboarding — `CreditPool` deposits aren't score-gated. The only
prerequisite is test USDC, which the app bar's "Get test USDC" button covers
by calling `MockUSDC.mint()` directly from the connected wallet (permissionless
on testnet).

## Test / typecheck

```
