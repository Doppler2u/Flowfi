export const FlowFiABI = [
  { inputs: [], type: "error", name: "ContentAlreadyExists" },
  { inputs: [], type: "error", name: "ContentAlreadyUnlocked" },
  { inputs: [], type: "error", name: "ContentDoesNotExist" },
  { inputs: [], type: "error", name: "InsufficientBalance" },
  { inputs: [], type: "error", name: "InvalidSplitPercent" },
  { inputs: [], type: "error", name: "TransferFailed" },
  {
    inputs: [
      { internalType: "uint256", name: "contentId", type: "uint256", indexed: true },
      { internalType: "address", name: "creator", type: "address", indexed: true },
      { internalType: "uint256", name: "price", type: "uint256", indexed: false },
    ],
    type: "event",
    name: "ContentCreated",
    anonymous: false,
  },
  {
    inputs: [
      { internalType: "address", name: "user", type: "address", indexed: true },
      { internalType: "uint256", name: "contentId", type: "uint256", indexed: true },
    ],
    type: "event",
    name: "ContentUnlocked",
    anonymous: false,
  },
  {
    inputs: [
      { internalType: "address", name: "user", type: "address", indexed: true },
      { internalType: "uint256", name: "amount", type: "uint256", indexed: false },
    ],
    type: "event",
    name: "Deposit",
    anonymous: false,
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address", indexed: true },
      { internalType: "address", name: "toPrimary", type: "address", indexed: true },
      { internalType: "address", name: "toSecondary", type: "address", indexed: true },
      { internalType: "uint256", name: "amount", type: "uint256", indexed: false },
    ],
    type: "event",
    name: "PaymentRouted",
    anonymous: false,
  },
  {
    inputs: [
      { internalType: "address", name: "user", type: "address", indexed: true },
      { internalType: "uint256", name: "cost", type: "uint256", indexed: false },
    ],
    type: "event",
    name: "ServiceUsed",
    anonymous: false,
  },
  {
    inputs: [
      { internalType: "address", name: "user", type: "address", indexed: true },
      { internalType: "uint256", name: "amount", type: "uint256", indexed: false },
    ],
    type: "event",
    name: "Withdraw",
    anonymous: false,
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
    name: "balances",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
    name: "contents",
    outputs: [
      { internalType: "address", name: "creator", type: "address" },
      { internalType: "uint256", name: "price", type: "uint256" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
  },
  {
    inputs: [
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "uint256", name: "price", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
    name: "createContent",
    outputs: [],
  },
  { inputs: [], stateMutability: "payable", type: "function", name: "deposit", outputs: [] },
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
    name: "hasAccess",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
  },
  {
    inputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      {
        components: [
          { internalType: "address", name: "primaryRecipient", type: "address" },
          { internalType: "address", name: "secondaryRecipient", type: "address" },
          { internalType: "uint256", name: "splitPercent", type: "uint256" },
        ],
        internalType: "struct FlowFi.Route",
        name: "route",
        type: "tuple",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
    name: "routePayment",
    outputs: [],
  },
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
    name: "unlockContent",
    outputs: [],
  },
  {
    inputs: [{ internalType: "uint256", name: "cost", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
    name: "useService",
    outputs: [],
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
    name: "withdraw",
    outputs: [],
  },
] as const;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
