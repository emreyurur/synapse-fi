# SynapseFi

Uncollateralized USDC credit lines for AI agents on [Arc](https://www.arc.network) — priced by
what an agent actually earns, not what it holds. SynapseFi reads an agent's onchain reputation
(ERC-8004) and job/nanopayment revenue (ERC-8183), turns that into a 0–100 credit score via an
oracle, and opens a credit line against that score through an ERC-4626 lending pool. Repayment is
cut automatically from the agent's incoming revenue via a per-agent `RevenueSplitter` until the
debt clears — no manual repayment, no collateral.

LPs supply USDC to the pool and earn a utilization-based yield; agents draw against their score;
a public Agent Market shows every scored agent's line, health, and revenue history.

## Deployed contracts (Arc Testnet)

Chain ID `5042002` · Explorer: [testnet.arcscan.app](https://testnet.arcscan.app)

| Contract | Address |
|---|---|
| MockUSDC | `0xf308ad06F61765F7F47b6A0c67C1443DC70633E0` |
| ScoreOracle | `0x688bac7FC391492Efad97bd53801058b3c72b550` |
| InterestRateModel | `0x1e420671f1cd6300659e503B62a202895dC0E346` |
| CreditPool (ERC-4626) | `0xd52FE9eDE0B4c80cCCd16e7d43E3409243c780Eb` |
| CreditLineManager | `0xd1b961b3F4f9A54906e88A205b58ce38a501704B` |
| RevenueRouterFactory | `0xbcB73B220B98065B2Dd05008Ca2cD00c5ed9833A` |
| MockAgentRegistry (ERC-8004 stand-in) | `0xB702cA80E792Ad0b04D34D9F78a8be7aF7e835D5` |
| MockJobBoard (ERC-8183 stand-in) | `0x4503e5cADc62A48Ac935B05bAF1e31A5083c9795` |

## Tech stack

### Frontend (`apps/web`)

- Next.js 16 (App Router) + React 19, TypeScript
- wagmi 3 + viem 2 for wallet connection and contract reads/writes
- TanStack Query for API data fetching and cache invalidation
- Tailwind CSS v4, bridged into the app's own CSS-variable design tokens (light/dark)
- Framer Motion for entrance/scroll animations, Lucide for icons

### Backend (`apps/api`, `packages/indexer`)

- [Hono](https://hono.dev) REST API on Node.js + TypeScript
- [Ponder](https://ponder.sh) indexer — watches `ScoreOracle`, `CreditLineManager`, `CreditPool`,
  the agent registry, and the job board, writing to Postgres
- PostgreSQL + Drizzle ORM (single schema shared by the indexer and the API)
- viem for on-chain reads/writes; an oracle worker (`node-cron`) recomputes agent scores each
  epoch and pushes them to `ScoreOracle`

### Contracts (`packages/contracts`)

- Solidity 0.8.30, [Foundry](https://book.getfoundry.sh) (forge/anvil/cast)
- OpenZeppelin (ERC-4626 vault, `Ownable`, `ReentrancyGuard`)

### Circle & Arc

- Deployed on [Arc Testnet](https://www.arc.network) — Circle's EVM-compatible L1 purpose-built
  for stablecoin finance, where gas is paid in USDC itself instead of a separate native token
- USDC (via `MockUSDC` on testnet — same ERC-20 interface a canonical USDC deployment would use)
  is the sole settlement asset across the pool, credit lines, and revenue routing
- Agent identity and job/payment history follow the ERC-8004 (onchain reputation) and ERC-8183
  (job board / nanopayment) standards the wider agent economy is converging on

## Hosting

- Frontend: Vercel
- API + indexer: Railway
- Database: PostgreSQL
