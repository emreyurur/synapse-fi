// Hand-maintained ABIs (event + the functions the backend calls) for the
// SynapseFi contracts. Kept in sync with packages/contracts/src by hand until
// a `forge build` step wires generated artifacts in. viem-compatible `as const`.

export const scoreOracleAbi = [
  {
    type: "event",
    name: "ScoreUpdated",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "score", type: "uint16", indexed: false },
      { name: "epoch", type: "uint64", indexed: true },
      { name: "factorsHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "function",
    name: "setScore",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "score", type: "uint16" },
      { name: "epoch", type: "uint64" },
      { name: "factorsHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setScores",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agents", type: "address[]" },
      { name: "scores", type: "uint16[]" },
      { name: "epoch", type: "uint64" },
      { name: "hashes", type: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getScore",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "score", type: "uint16" },
      { name: "fresh", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "setUpdater",
    stateMutability: "nonpayable",
    inputs: [
      { name: "updater", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
] as const;

export const creditLineManagerAbi = [
  {
    type: "event",
    name: "LineOpened",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "treasury", type: "address", indexed: true },
      { name: "splitter", type: "address", indexed: false },
      { name: "limit", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Drawn",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "aprBps", type: "uint16", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Repaid",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "principal", type: "uint256", indexed: false },
      { name: "interest", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Accrued",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "interest", type: "uint256", indexed: false },
      { name: "newAprBps", type: "uint16", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LineClosed",
    inputs: [{ name: "agent", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "Defaulted",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "debt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "openLine",
    stateMutability: "nonpayable",
    inputs: [{ name: "treasury", type: "address" }],
    outputs: [{ name: "splitter", type: "address" }],
  },
  {
    type: "function",
    name: "draw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "creditLimit",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalDebt",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "used", type: "uint256" }],
  },
  {
    type: "function",
    name: "currentAprBps",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "lines",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "principal", type: "uint128" },
      { name: "interestAccrued", type: "uint128" },
      { name: "lastAccrual", type: "uint64" },
      { name: "breachSince", type: "uint64" },
      { name: "aprBps", type: "uint16" },
      { name: "status", type: "uint8" },
      { name: "treasury", type: "address" },
      { name: "splitter", type: "address" },
    ],
  },
] as const;

export const creditPoolAbi = [
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdraw",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LentOut",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RepaymentReceived",
    inputs: [
      { name: "principal", type: "uint256", indexed: false },
      { name: "interest", type: "uint256", indexed: false },
      { name: "toReserves", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalLent",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "reserves",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "utilizationBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Standard ERC-4626 / ERC-20 surface (inherited from OpenZeppelin) — needed
  // by the frontend for LP position reads and the withdraw flow.
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxWithdraw",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
] as const;

export const revenueSplitterAbi = [
  {
    type: "event",
    name: "Flushed",
    inputs: [
      { name: "toPool", type: "uint256", indexed: false },
      { name: "toTreasury", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "flush",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [
      { name: "toPool", type: "uint256" },
      { name: "toTreasury", type: "uint256" },
    ],
  },
] as const;

export const revenueRouterFactoryAbi = [
  {
    type: "event",
    name: "SplitterCreated",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "splitter", type: "address", indexed: true },
      { name: "treasury", type: "address", indexed: true },
    ],
  },
  {
    type: "function",
    name: "splitterOf",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const agentRegistryAbi = [
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "id", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ReputationChanged",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "newReputation", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "agents",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "reputation", type: "uint256" },
      { name: "registered", type: "bool" },
    ],
  },
] as const;

export const jobBoardAbi = [
  {
    type: "event",
    name: "JobPosted",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "poster", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "payTo", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "JobCompleted",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "payTo", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "JobDisputed",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "NanoPayment",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "payTo", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "postJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "payTo", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    type: "function",
    name: "completeJob",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "disputeJob",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "payNano",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "payTo", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const erc20Abi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
