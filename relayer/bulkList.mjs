import { createWalletClient, createPublicClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ── Config ────────────────────────────────────────────────────────────────
const PRIVATE_KEY = "0x0838b2cb1e513d71474548496f50b3d11e7f404829737aec912449405457760c";
const CONTRACT    = "0xd12770bdCa37B4FdC2A01839168F4ceB44503917";
const RPC         = "https://rpc.testnet.arc.network";
const PINATA_JWT  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI3N2MyYzhjMS0zMjIwLTQ0ZDAtOTgyYy0xZGM2YWVlYmNmYzAiLCJlbWFpbCI6ImFkYXJzaHRoYXBhOTU1NTVAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6Ijc1YTExNDkyMTBkNzQ1MTIzZGY5Iiwic2NvcGVkS2V5U2VjcmV0IjoiMzU2YTI1NGY4YzlmOTZiOTRmYWFjNGFmZmJhM2MzNTRkNTlkZjZiYmVjNDdhOGFiMTRlYzVkMWVmNjBhNDQ2MCIsImV4cCI6MTgwODIyNjI1NH0.tmhBfws7WY8b-bblRLUQ0oMt77rnwNokAaUKx9mHj1c";
const TOTAL       = 200;

// ── ABI (only what we need) ───────────────────────────────────────────────
const ABI = [
  {
    name: "createContent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "contentId",    type: "uint256" },
      { name: "price",        type: "uint256" },
      { name: "metadataURI",  type: "string"  },
    ],
    outputs: [],
  },
  {
    name: "contents",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "creator",     type: "address" },
      { name: "price",       type: "uint256" },
      { name: "metadataURI", type: "string"  },
      { name: "exists",      type: "bool"    },
    ],
  },
];

const ARC_CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  network: "arc-testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [RPC] }, public: { http: [RPC] } },
};

// ── Content catalog (40 items × 5 types = 200) ───────────────────────────
const CATALOG = {
  Article: [
    ["DeFi Arbitrage Playbook",         "Step-by-step guide to cross-chain arbitrage on Circle's Arc network with live examples.",           "0.05"],
    ["USDC Yield Farming Strategies",   "Advanced yield farming strategies using native USDC liquidity pools on Arc Testnet.",              "0.08"],
    ["Arc Network Deep Dive",           "Complete technical breakdown of Circle's L1 blockchain architecture and consensus mechanism.",      "0.1" ],
    ["FlowFi Protocol Whitepaper",      "Full whitepaper explaining the FlowFi content marketplace and AI arbitration mechanism.",          "0.12"],
    ["Smart Contract Security Guide",   "Common vulnerabilities in Solidity contracts and how to prevent them with real audits.",           "0.07"],
    ["GenLayer AI Arbitration Manual",  "How GenLayer Intelligent Contracts resolve disputes autonomously using AI jury consensus.",        "0.09"],
    ["Circle CCTP Explained",           "Cross-Chain Transfer Protocol mechanics — how USDC moves natively between chains.",                "0.06"],
    ["Web3 Creator Economy 2025",       "Monetization strategies for content creators in the decentralized web economy.",                   "0.04"],
    ["Zero Knowledge Proofs for Devs",  "Practical ZK-proof implementation guide for Ethereum and Arc compatible smart contracts.",         "0.15"],
    ["On-Chain Governance Handbook",    "Best practices for DAO governance structures, voting mechanisms, and treasury management.",        "0.08"],
    ["MEV Protection Strategies",       "Protecting your transactions from maximal extractable value attacks on EVM-compatible chains.",    "0.1" ],
    ["Arc RPC Optimization Guide",      "Techniques to optimize RPC calls and reduce latency when building on Arc Testnet.",               "0.05"],
    ["Lit Protocol Encryption Guide",   "Using Lit Protocol for programmable key management and threshold encryption in Web3 apps.",       "0.09"],
    ["IPFS Pinning Best Practices",     "Reliable content addressing and persistence strategies using IPFS and Pinata for dApps.",          "0.04"],
    ["DeFi Risk Management Framework",  "Quantitative risk assessment models for liquidity pools, vaults, and lending protocols.",          "0.13"],
    ["Solidity Gas Optimization",       "50 proven techniques to reduce gas costs in Solidity smart contracts with benchmarks.",            "0.07"],
    ["Cross-Chain Bridge Security",     "Security analysis of cross-chain bridge architectures and how to choose safe bridges.",            "0.1" ],
    ["Account Abstraction EIP-4337",    "Implementation guide for smart contract wallets using ERC-4337 account abstraction.",              "0.12"],
    ["Tokenomics Design Patterns",      "Frameworks for designing sustainable token economies with flywheel effects and incentives.",       "0.08"],
    ["Layer 2 Scaling Comparison",      "Technical comparison of Optimistic Rollups, ZK Rollups, and alternative L2 scaling solutions.",   "0.06"],
    ["Arc Testnet Developer Quickstart","Complete onboarding guide for developers building their first dApp on Circle's Arc Testnet.",      "0.03"],
    ["Flash Loan Attack Anatomy",       "Deep dive into flash loan attack vectors with case studies and mitigation strategies.",             "0.11"],
    ["NFT Marketplace Economics",       "Economic analysis of NFT marketplace fee structures, royalties, and creator monetization.",       "0.07"],
    ["Decentralized Identity Primer",   "Introduction to DID, Verifiable Credentials, and on-chain identity solutions for Web3.",          "0.05"],
    ["Stablecoin Mechanism Design",     "Comparative analysis of algorithmic, collateralized, and hybrid stablecoin architectures.",       "0.09"],
    ["Crypto Tax Optimization Guide",   "Legal strategies for minimizing crypto tax liability across multiple jurisdictions in 2025.",      "0.08"],
    ["Protocol Revenue Models",         "How leading DeFi protocols generate sustainable revenue without compromising decentralization.",   "0.1" ],
    ["Viem.sh Developer Guide",         "Building modern dApps with Viem — the type-safe Ethereum interface library for TypeScript.",      "0.06"],
    ["Arc Wallet Integration Guide",    "Step-by-step guide to integrating Arc Testnet into MetaMask and other EVM-compatible wallets.",   "0.04"],
    ["On-Chain Analytics Framework",    "Building custom blockchain analytics dashboards using The Graph subgraphs and Arc event logs.",   "0.08"],
    ["Smart Wallet UX Patterns",        "Design patterns for account abstraction wallets that improve Web3 user experience.",               "0.07"],
    ["Perpetual Protocol Design",       "How perpetual futures protocols maintain price parity using funding rates and AMM mechanisms.",   "0.12"],
    ["Content Monetization Web3",       "Practical guide to monetizing digital content using smart contract escrow and NFT access gates.", "0.05"],
    ["Crypto Privacy Techniques",       "Using mixers, ZK-proofs, and privacy coins to maintain financial privacy on public blockchains.", "0.09"],
    ["Validator Economics Deep Dive",   "Economic incentives and slashing conditions for validators on Proof of Stake networks.",           "0.1" ],
    ["dApp Architecture Patterns",      "Modern architecture patterns for scalable, secure, and user-friendly decentralized applications.", "0.07"],
    ["Impermanent Loss Calculator",     "Mathematical framework for calculating and hedging impermanent loss in AMM liquidity pools.",      "0.06"],
    ["Web3 Legal Compliance Guide",     "Navigating securities law, KYC/AML requirements, and DAO legal structures globally.",             "0.15"],
    ["Blockchain Interoperability",     "Technical overview of IBC, LayerZero, and Axelar cross-chain messaging protocols.",               "0.08"],
    ["Arc Ecosystem Project Directory", "Comprehensive directory of projects building on Circle's Arc Testnet with contact info.",         "0.02"],
  ],
  Video: [
    ["Live Trading Arc Testnet",        "Full trading session walkthrough on Arc Testnet with real-time analysis and commentary.",          "0.15"],
    ["FlowFi Complete Tutorial",        "End-to-end tutorial: deposit USDC, buy content, raise dispute, claim payout on FlowFi.",          "0.1" ],
    ["Foundry Smart Contract Course",   "Complete Foundry development course: forge, cast, deploy, test on Arc Testnet.",                  "0.2" ],
    ["DeFi Yield Farming Masterclass",  "Hands-on yield farming session across Arc Testnet liquidity pools with strategy breakdowns.",     "0.25"],
    ["Solidity Bootcamp Day 1",         "Day 1 of 10-day Solidity bootcamp: variables, functions, modifiers, and events.",                 "0.18"],
    ["React + Viem dApp Build",         "Build a full-stack dApp with React, Viem, and Arc Testnet from scratch in 2 hours.",              "0.22"],
    ["GenLayer AI Contract Demo",       "Live demo of GenLayer Intelligent Contracts making autonomous on-chain decisions.",               "0.12"],
    ["Circle CCTP Bridge Demo",         "Step-by-step video demo: bridging USDC from Ethereum Sepolia to Arc Testnet via CCTP.",           "0.08"],
    ["MEV Bot Development",             "Building a profitable MEV bot on EVM chains: sandwich attacks, frontrunning, and backrunning.",   "0.3" ],
    ["NFT Collection Launch Guide",     "Complete video guide to launching an NFT collection: art, smart contracts, marketplace listing.", "0.2" ],
    ["Arc Node Setup Tutorial",         "Setting up and running a full Arc Testnet node from scratch on Ubuntu server.",                   "0.1" ],
    ["DeFi Dashboard Build",            "Building a real-time DeFi dashboard with on-chain data using Viem and React.",                   "0.18"],
    ["Smart Contract Audit Walkthrough","Professional smart contract audit session: finding vulnerabilities in real code.",                "0.25"],
    ["Crypto Portfolio Strategy 2025",  "Building a diversified crypto portfolio with DeFi yield optimization strategies.",               "0.15"],
    ["Hardhat Testing Masterclass",     "Comprehensive testing strategies for Solidity smart contracts using Hardhat and Waffle.",         "0.2" ],
    ["Web3 Authentication Tutorial",    "Implementing Sign-In With Ethereum (SIWE) and wallet-based authentication in React apps.",       "0.12"],
    ["Gas Optimization Live Session",   "Live code review and optimization session reducing gas costs by 40% on real contracts.",          "0.18"],
    ["Layer 2 Migration Guide",         "Migrating a production dApp from Ethereum mainnet to Arc Testnet step-by-step.",                 "0.15"],
    ["Flash Loan Arbitrage Bot",        "Building a flash loan arbitrage bot on Arc Testnet with viem and automated execution.",           "0.28"],
    ["Creator Economy Workshop",        "Workshop on building sustainable creator economies using NFTs and token-gated content.",          "0.14"],
    ["DAO Governance Implementation",   "Implementing on-chain DAO governance with OpenZeppelin Governor contracts and Tally.",            "0.2" ],
    ["DeFi Protocol Fork Tutorial",     "Forking and customizing a DeFi protocol: Uniswap V3 fork on Arc Testnet.",                       "0.22"],
    ["Chainlink Oracle Integration",    "Integrating Chainlink price feeds and VRF into Arc Testnet smart contracts.",                    "0.16"],
    ["Crypto Wallet Development",       "Building a non-custodial crypto wallet from scratch: key management, signing, broadcasting.",    "0.25"],
    ["IPFS + Filecoin Deep Dive",       "Using IPFS and Filecoin for decentralized storage in production Web3 applications.",             "0.14"],
    ["Zero-Knowledge App Tutorial",     "Building your first ZK application using Circom and SnarkJS with Arc Testnet deployment.",       "0.3" ],
    ["DeFi Liquidation Bots",           "Building automated liquidation bots for lending protocols on EVM-compatible blockchains.",        "0.28"],
    ["Arc Testnet Stress Test",         "Performance analysis and stress testing of Arc Testnet under high transaction loads.",            "0.1" ],
    ["Token Launch Strategy",           "Complete token launch playbook: tokenomics, liquidity, marketing, and community building.",      "0.2" ],
    ["Cross-Chain dApp Tutorial",       "Building a cross-chain dApp that works seamlessly across Ethereum, Arc, and other EVM chains.",  "0.18"],
    ["Viem Advanced Patterns",          "Advanced Viem patterns: multicall, batch transactions, event subscriptions, and type safety.",   "0.15"],
    ["Smart Contract Deployment CI/CD", "Setting up automated CI/CD pipeline for Solidity smart contract deployment with GitHub Actions.","0.12"],
    ["DeFi Analytics Dashboard",        "Building a professional DeFi analytics dashboard with real-time on-chain data visualization.",   "0.2" ],
    ["Wallet Connect Integration",      "Integrating WalletConnect v2 into your dApp with multi-chain support and session management.",   "0.14"],
    ["Arc Testnet Hackathon Winners",   "Showcasing the top projects from the first Arc Testnet hackathon with founder interviews.",      "0.08"],
    ["Stablecoin Arbitrage Strategy",   "Automated stablecoin arbitrage across DEXs on Arc Testnet with backtested results.",             "0.22"],
    ["NFT Royalty Implementation",      "Implementing EIP-2981 NFT royalty standard with secondary market enforcement on Arc.",           "0.16"],
    ["GameFi Economics Tutorial",       "Designing sustainable play-to-earn economics: token sinks, faucets, and player incentives.",     "0.18"],
    ["DeFi Security Best Practices",    "Security-first development: reentrancy guards, access controls, and audit preparation.",          "0.2" ],
    ["Arc Mainnet Preparation Guide",   "Preparing your Arc Testnet project for mainnet launch: security, gas, and UX checklist.",        "0.12"],
  ],
  Code: [
    ["FlowFi Solidity Template",        "Production-ready Solidity escrow contract template with dispute resolution and payout logic.",    "0.08"],
    ["Viem TypeScript Starter Kit",     "Complete TypeScript starter kit for Arc Testnet dApps with Viem, Next.js, and wagmi.",           "0.1" ],
    ["ERC-20 Token Contract",           "Gas-optimized ERC-20 token contract with permit, snapshot, and governance extensions.",          "0.06"],
    ["Multi-sig Wallet Contract",       "Audited multi-signature wallet contract with configurable threshold and time-locks.",             "0.12"],
    ["NFT Collection Contract",         "ERC-721A NFT collection with batch minting, whitelist, and royalty support.",                    "0.09"],
    ["AMM DEX Contract",                "Minimal automated market maker (AMM) implementation with constant product formula.",             "0.15"],
    ["Lending Protocol Template",       "Collateralized lending protocol with liquidation engine and interest rate model.",                "0.18"],
    ["Governance Contract Suite",       "Complete DAO governance suite: token, timelock, governor, and voting contracts.",                "0.14"],
    ["Merkle Airdrop Contract",         "Gas-efficient Merkle tree airdrop contract supporting up to 1M recipients.",                    "0.07"],
    ["Staking Rewards Contract",        "ERC-20 staking rewards contract with compound interest and cooldown period.",                    "0.08"],
    ["Flash Loan Provider",             "ERC-3156 compliant flash loan provider contract with fee configuration.",                        "0.12"],
    ["NFT Marketplace Contract",        "Decentralized NFT marketplace with auction, fixed price, and offer mechanisms.",                  "0.15"],
    ["Cross-Chain Bridge Contract",     "Simplified cross-chain bridge contract using burn-mint pattern for USDC transfers.",             "0.2" ],
    ["Token Vesting Contract",          "Linear and cliff vesting contract with revocable schedules and emergency recovery.",             "0.1" ],
    ["Price Oracle Contract",           "On-chain TWAP oracle contract with manipulation resistance and staleness checks.",               "0.09"],
    ["Escrow Contract Template",        "Flexible escrow contract supporting multiple tokens, conditions, and arbitration roles.",        "0.11"],
    ["Arc Testnet Deploy Script",       "Foundry deployment scripts for Arc Testnet with verification, broadcast, and gas reporting.",    "0.05"],
    ["React Web3 Boilerplate",          "Production-ready React + Viem boilerplate with wallet connect, network switching, and hooks.",   "0.08"],
    ["Hardhat Testing Suite",           "Comprehensive Hardhat testing suite with fixtures, snapshots, and coverage reporting.",          "0.07"],
    ["Solidity Utilities Library",      "Gas-optimized Solidity utility library: math, strings, addresses, bytes, and array helpers.",   "0.09"],
    ["Permit2 Integration",             "Uniswap Permit2 integration for gasless token approvals in your smart contracts.",               "0.1" ],
    ["ERC-4337 Account Abstraction",    "ERC-4337 compliant smart wallet with social recovery and session keys.",                        "0.18"],
    ["Chainlink VRF Integration",       "Verifiable random function integration with Chainlink VRF v2 for fair on-chain randomness.",     "0.09"],
    ["Subgraph Indexer Template",       "The Graph subgraph template for indexing Arc Testnet events with TypeScript mappings.",          "0.1" ],
    ["Gas Reporter Config",             "Hardhat gas reporter configuration with custom token prices and CI integration.",               "0.04"],
    ["Foundry Fuzz Testing Suite",      "Advanced fuzz testing suite for Solidity using Foundry's built-in fuzzer with invariants.",     "0.08"],
    ["OpenZeppelin Upgrade Template",   "Transparent and UUPS upgradeable proxy pattern implementation with migration scripts.",          "0.12"],
    ["DeFi Integration Test Suite",     "End-to-end integration test suite for DeFi protocols with mainnet forking.",                    "0.1" ],
    ["Circle CCTP Integration",         "TypeScript SDK for integrating Circle's Cross-Chain Transfer Protocol into your dApp.",          "0.12"],
    ["Arc Event Scanner",               "Efficient Arc Testnet event scanner with chunked batch queries and retry logic.",               "0.07"],
    ["Next.js dApp Template",           "Next.js 14 dApp template with Viem, RainbowKit, Tailwind, and Arc Testnet config.",            "0.1" ],
    ["Solidity Code Coverage",          "Istanbul code coverage setup for Solidity with HTML reports and branch analysis.",               "0.05"],
    ["Token Lock Contract",             "Time-locked token contract with multi-beneficiary support and early withdrawal penalties.",      "0.08"],
    ["Batch Transaction Helper",        "Solidity contract and TypeScript helper for batching multiple transactions in one call.",        "0.09"],
    ["Arc Multicall Implementation",    "Multicall3 implementation optimized for Arc Testnet with static and dynamic call support.",      "0.07"],
    ["ERC-1155 Multi-Token",            "ERC-1155 multi-token standard implementation with batch transfers and URI management.",          "0.09"],
    ["Decentralized Oracle Network",    "Minimal decentralized oracle network implementation with aggregation and dispute resolution.",   "0.15"],
    ["Wallet Signature Verifier",       "TypeScript library for verifying EIP-712 structured data signatures from any EVM wallet.",      "0.06"],
    ["Smart Contract Fuzzer Config",    "Echidna and Medusa fuzzer configuration templates for catching edge cases in DeFi contracts.",  "0.08"],
    ["Arc Testnet Config Pack",         "Complete Arc Testnet configuration pack for Hardhat, Foundry, Viem, and wagmi.",               "0.03"],
  ],
  Image: [
    ["Arc Testnet Network Map",         "High-resolution infographic of Arc Testnet architecture, nodes, and ecosystem connections.",     "0.02"],
    ["FlowFi Protocol Diagram",         "Detailed flowchart of FlowFi's escrow, dispute, and AI arbitration system.",                   "0.03"],
    ["DeFi Ecosystem Map 2025",         "Comprehensive visual map of the DeFi ecosystem organized by protocol category.",                "0.04"],
    ["Circle USDC Flow Chart",          "Visual guide to USDC minting, burning, and cross-chain movement via Circle CCTP.",             "0.02"],
    ["Smart Contract Security Poster",  "Security checklist poster: 30 must-check items before deploying any smart contract.",          "0.03"],
    ["Blockchain Architecture Art",     "Abstract digital artwork representing blockchain nodes, connections, and consensus.",            "0.05"],
    ["Arc Testnet Dashboard Screenshot","Annotated screenshot of Arc Testnet explorer with key metrics and analytics explained.",        "0.02"],
    ["DeFi Yield Comparison Chart",     "Visual comparison of yield rates across major DeFi protocols in Q1 2025.",                     "0.03"],
    ["NFT Market Analysis Chart",       "Data visualization of NFT market trends, volume, and price performance 2024-2025.",            "0.04"],
    ["Crypto Fear & Greed Analysis",    "Historical analysis of crypto fear & greed index correlation with market performance.",         "0.03"],
    ["Layer 2 Comparison Matrix",       "Visual comparison matrix of all major Layer 2 solutions by security, speed, and cost.",        "0.04"],
    ["Solidity Best Practices Poster",  "Reference poster: Solidity coding standards, security patterns, and gas optimization tips.",   "0.02"],
    ["Web3 Stack Architecture",         "Clean architecture diagram of a modern full-stack Web3 application.",                          "0.03"],
    ["Token Distribution Visualizer",   "Interactive-style token distribution visualization for major DeFi protocol launches.",          "0.04"],
    ["Arc Validator Network Art",       "Artistic visualization of Arc Testnet validator nodes and network topology.",                  "0.05"],
    ["DeFi Risk Heatmap",               "Risk heatmap visualization across DeFi protocols: TVL, audit status, and incident history.",   "0.04"],
    ["Crypto Market Cycle Chart",       "Historical chart of crypto market cycles with key support/resistance levels annotated.",        "0.03"],
    ["GenLayer AI Jury Diagram",        "Visual explanation of GenLayer's AI jury consensus mechanism for dispute resolution.",          "0.03"],
    ["EVM Transaction Lifecycle",       "Step-by-step visual guide to how an EVM transaction goes from wallet to block.",               "0.02"],
    ["Wallet Security Infographic",     "Visual guide to crypto wallet security: hardware wallets, seed phrases, and best practices.",  "0.02"],
    ["Gas Price History Chart",         "Historical gas price chart for Ethereum mainnet with event annotations.",                      "0.03"],
    ["DeFi Composability Map",          "Visual map showing how DeFi money legos connect and compose across protocols.",                "0.04"],
    ["Arc Ecosystem Partner Logos",     "High-res collection of official Arc ecosystem partner and builder logos.",                     "0.02"],
    ["Merkle Tree Visualization",       "Beautiful visualization of Merkle tree structure used in blockchain proof systems.",            "0.03"],
    ["Cross-Chain Bridge Diagram",      "Technical diagram of how cross-chain bridges lock, mint, and verify assets.",                  "0.03"],
    ["Protocol Revenue Chart",          "Comparative chart of annualized revenue for top DeFi protocols in 2025.",                     "0.04"],
    ["On-Chain Analytics Dashboard",    "Sample analytics dashboard design for tracking on-chain DeFi metrics.",                       "0.03"],
    ["Crypto Regulation World Map",     "World map visualization of crypto regulations by country as of 2025.",                        "0.04"],
    ["NFT Rarity Distribution Art",     "Statistical visualization of NFT rarity distributions across major collections.",              "0.03"],
    ["Arc Block Explorer Guide",        "Annotated guide to reading and interpreting Arc Testnet block explorer data.",                  "0.02"],
    ["Tokenomics Design Canvas",        "Visual framework canvas for designing sustainable token economic systems.",                    "0.04"],
    ["Smart Contract Upgrade Diagram",  "Visual guide to proxy upgrade patterns: transparent, UUPS, and diamond standard.",             "0.03"],
    ["DeFi Lending Market Chart",       "Market size and TVL comparison of major DeFi lending protocols over time.",                   "0.04"],
    ["DAO Governance Flow Chart",       "Visual explanation of how DAO proposals move from creation to on-chain execution.",            "0.03"],
    ["Crypto Portfolio Allocation Art", "Artistic visualization of an optimized crypto portfolio allocation strategy.",                 "0.05"],
    ["Blockchain Consensus Diagram",    "Comparative diagram of PoW, PoS, and dPoS consensus mechanisms with validators.",             "0.03"],
    ["Circle Ecosystem Map",            "Official-style ecosystem map of Circle's products: USDC, CCTP, Arc, and developer tools.",   "0.04"],
    ["Web3 Identity Stack",             "Visual stack diagram of decentralized identity: DIDs, VCs, and on-chain attestations.",       "0.03"],
    ["Arc Testnet Roadmap Visual",      "Visual timeline of Arc Testnet milestones and upcoming mainnet launch targets.",               "0.02"],
    ["Crypto UX Design Patterns",       "UI/UX pattern library for Web3 applications: wallet connect, transactions, and errors.",      "0.04"],
  ],
  Audio: [
    ["Arc Testnet Builder Podcast E1",  "Episode 1: Founders of the first projects built on Circle's Arc Testnet share their story.",    "0.03"],
    ["DeFi Alpha Podcast E1",           "Episode 1: Discovering yield opportunities on Arc Testnet with the FlowFi team.",              "0.04"],
    ["Solidity Deep Dive Podcast",      "Audio walkthrough of advanced Solidity patterns: assembly, storage layout, and gas tricks.",   "0.05"],
    ["Crypto Market Analysis Audio",    "Weekly crypto market analysis covering technical indicators, on-chain metrics, and macro.",     "0.04"],
    ["Web3 Career Path Audio Guide",    "Audio guide to breaking into Web3: skills, portfolio, networking, and job hunting strategies.", "0.03"],
    ["DeFi Risk Assessment Podcast",    "Expert discussion on evaluating and managing risk in DeFi protocol investments.",               "0.05"],
    ["Circle USDC Stablecoin Deep Dive","Deep dive audio analysis of USDC's mechanism, reserves, audits, and competitive position.",   "0.04"],
    ["GenLayer Technology Explained",   "Technical audio explainer of GenLayer's optimistic machine learning consensus mechanism.",     "0.05"],
    ["Smart Contract Audit Podcast",    "Security researchers discuss real smart contract vulnerabilities and how they were exploited.", "0.06"],
    ["Crypto Regulatory Update",        "Weekly audio briefing on crypto regulation developments across US, EU, and Asia-Pacific.",     "0.04"],
    ["FlowFi Architecture Explained",   "Audio walkthrough of FlowFi's smart contract architecture, escrow system, and dispute flow.",  "0.03"],
    ["DeFi Founder Interview Series",   "In-depth interview with a DeFi protocol founder on building, fundraising, and scaling.",      "0.06"],
    ["On-Chain Analytics Audio Report", "Weekly on-chain analytics audio report: whale movements, DEX volumes, and TVL changes.",      "0.04"],
    ["Layer 2 Technology Podcast",      "Technical discussion comparing ZK Rollups, Optimistic Rollups, and alternative L2 solutions.", "0.05"],
    ["Arc Testnet Developer AMA",       "Audio recording of an Arc Testnet developer AMA with the core Circle engineering team.",      "0.03"],
    ["Tokenomics Design Workshop",      "Audio workshop on designing sustainable token economies with real protocol case studies.",     "0.07"],
    ["Web3 Security Podcast",           "Security researchers discuss the latest DeFi exploits and how to protect your protocol.",     "0.05"],
    ["Crypto Trading Psychology",       "Audio guide to managing trading psychology: discipline, FOMO, fear, and decision-making.",    "0.04"],
    ["Blockchain Scalability Podcast",  "Expert panel discussion on blockchain scalability: sharding, rollups, and state channels.",   "0.05"],
    ["DAO Operations Masterclass",      "Audio masterclass on running an effective DAO: governance, treasury, and community.",         "0.06"],
    ["DeFi Yield Strategy Audio",       "Monthly DeFi yield strategy audio briefing with risk ratings and APY comparisons.",           "0.05"],
    ["NFT Market Intelligence Audio",   "Weekly NFT market intelligence briefing: trending collections, floor prices, and whale buys.", "0.04"],
    ["Crypto Compliance Audio Guide",   "Audio guide to staying compliant with crypto regulations while building Web3 applications.",  "0.06"],
    ["Web3 UX Research Podcast",        "Researchers share insights on improving Web3 user experience from real user studies.",        "0.04"],
    ["Arc Ecosystem Weekly",            "Weekly audio newsletter covering all new projects, partnerships, and updates on Arc Testnet.", "0.02"],
    ["Solidity Security Patterns",      "Audio walkthrough of essential Solidity security patterns every developer must know.",        "0.05"],
    ["DeFi MEV Explained",              "Technical audio explanation of maximal extractable value and its impact on DeFi protocols.",  "0.06"],
    ["Crypto Fundraising Guide Audio",  "Audio guide to raising capital for Web3 startups: VCs, angels, grants, and token launches.", "0.07"],
    ["On-Chain Governance Podcast",     "Analysis of on-chain governance proposals, voter participation, and governance attacks.",     "0.05"],
    ["Arc Testnet Roadmap Discussion",  "Core team discussion on Arc Testnet roadmap, upcoming features, and mainnet timeline.",      "0.03"],
    ["DeFi Composability Podcast",      "Expert discussion on how DeFi money legos compose to create new financial primitives.",      "0.05"],
    ["Web3 Marketing Strategies",       "Audio guide to marketing Web3 products: community building, Twitter, and guerrilla tactics.", "0.04"],
    ["Crypto Wallet Security Audio",    "Security expert walkthrough of best practices for protecting crypto wallet seed phrases.",   "0.03"],
    ["Protocol Tokenomics Analysis",    "Detailed audio analysis of tokenomics for 5 major DeFi protocols with investment thesis.",   "0.06"],
    ["Arc Builder Community Call",      "Recording of monthly Arc builder community call with project updates and Q&A.",               "0.02"],
    ["DeFi Options Explained",          "Audio guide to on-chain options protocols: pricing, greeks, strategies, and risks.",          "0.07"],
    ["Web3 Data Analytics Audio",       "Audio guide to analyzing on-chain data with Dune Analytics, Nansen, and The Graph.",         "0.05"],
    ["Smart Contract Testing Audio",    "Audio guide to comprehensive smart contract testing: unit, fuzz, integration, and formal.",   "0.05"],
    ["Crypto Macro Outlook Audio",      "Monthly macro outlook audio briefing: interest rates, inflation, and crypto market impact.",  "0.04"],
    ["FlowFi Launch Story Podcast",     "Behind-the-scenes audio story of building and launching FlowFi on Arc Testnet.",              "0.03"],
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function uploadToIPFS(metadata) {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: metadata.title },
    }),
  });
  if (!res.ok) throw new Error(`Pinata error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return `ipfs://${json.IpfsHash}`;
}

function randomId(used) {
  let id;
  do { id = Math.floor(Math.random() * 900000) + 100000; } while (used.has(id));
  used.add(id);
  return id;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`🔑 Wallet: ${account.address}`);

  const publicClient = createPublicClient({ chain: ARC_CHAIN, transport: http(RPC) });
  const walletClient = createWalletClient({ chain: ARC_CHAIN, transport: http(RPC), account });

  // Build full list
  const items = [];
  for (const [type, list] of Object.entries(CATALOG)) {
    for (const [title, description, price] of list) {
      items.push({ type, title, description, price });
    }
  }

  // Shuffle for variety
  items.sort(() => Math.random() - 0.5);
  const toList = items.slice(0, TOTAL);

  const usedIds = new Set();
  let success = 0, failed = 0;

  console.log(`\n🚀 Listing ${toList.length} items on FlowFi...\n`);

  for (let i = 0; i < toList.length; i++) {
    const item = toList[i];
    const contentId = randomId(usedIds);

    console.log(`[${i+1}/${toList.length}] ${item.type}: "${item.title}" — ${item.price} USDC (ID: ${contentId})`);

    try {
      // 1. Upload metadata to IPFS
      process.stdout.write("  → Uploading to IPFS... ");
      const uri = await uploadToIPFS({
        title: item.title,
        description: item.description,
        type: item.type,
        version: "2.1.0",
      });
      console.log(`✓ ${uri}`);

      // 2. List on FlowFi
      process.stdout.write("  → Listing on Arc... ");
      const priceWei = parseUnits(item.price, 18);
      const hash = await walletClient.writeContract({
        address: CONTRACT,
        abi: ABI,
        functionName: "createContent",
        args: [BigInt(contentId), priceWei, uri],
        gas: 300000n,
      });

      await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      console.log(`✓ TX: ${hash}`);
      success++;

      // Small delay to avoid nonce issues
      await sleep(1500);
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message?.slice(0, 100)}`);
      failed++;
      await sleep(2000);
    }
  }

  console.log(`\n✅ Done! Success: ${success} | Failed: ${failed}`);
}

main().catch(console.error);
