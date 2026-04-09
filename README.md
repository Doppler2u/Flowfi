# FlowFi 🌊
### High-Performance Content Marketplace & Programmable Payment Hub

**FlowFi** is a decentralized platform built on the **Arc Network**, designed for seamless content monetization and deep-history asset recovery. It combines a **Refined Brutalist UI** with a robust "Bulletproof" indexing logic that ensures data integrity where standard RPCs often fail.

![FlowFi Dashboard](./frontend/public/screenshot.png)

---

## 🏆 Hackathon Highlights (Why FlowFi?)

### 1. 🛡️ Bulletproof Sync Engine
Most dApps rely on fragile RPC indexing that often breaks due to block limits or node latency. FlowFi implements a **Custom Sequential Block Scanner**:
- **Micro-Chunking**: Traverses history in 1,000-block segments for maximum RPC compatibility.
- **Race Condition Shield**: Implements a 10-block safety buffer to handle out-of-sync nodes in a load-balanced cluster.
- **Raw Log Decoding**: Uses low-level `decodeEventLog` with manual hex-encoding to bypass standard middleware issues.

### 2. 🎨 Refined Brutalist UX
A visual identity that matches the precision of the code:
- **Zero-Radius Design**: Stark, hard edges and thick borders for high-impact readability.
- **Dual-Theme Engine**: Sleek **Dark Mode** and high-contrast **Newsprint Light Mode**.
- **Diagnostic Activity Log**: Real-time system feedback providing transparency into the on-chain scanning process.

### 3. 💳 Advanced Payment Lifecycle
- **Native USDC Core**: All payments and balances use native USDC on Arc.
- **Circle App Kit Integration**: Seamlessly bridge liquidity from Ethereum Sepolia via CCTP (Circle App Kit + Viem Adapter).
- **Atomic Unlocking**: Content secrets are crytographically gated until the on-chain payment is confirmed.

---

## 🚀 Technical Stack

- **L1 Blockchain**: Arc Testnet (Circle L1)
- **Frontend**: Next.js 15 (App Router), Tailwind CSS v4
- **Web3 Library**: Viem v2, Wagmi
- **Liquidity**: Circle App Kit (CCTP Native Bridge)
- **Design**: Refined Brutalism (Space Grotesk & Space Mono)

---

## 📦 Key Use Cases

- **Pay-Per-View Content**: Creators sell Articles, Videos, and Code Snippets directly to users.
- **Deep History Recovery**: The "Rescue Scan" feature allows users to recover assets registered months ago by traversing up to 200,000 blocks.
- **Liquid Finance**: Real-time contract balance management for instant service payments.

---

## 🛠️ Local Setup

### 1. Smart Contract
Ensure you have [Foundry](https://getfoundry.sh/) installed.
```bash
# Build contracts
forge build

# Test logic
forge test -vvv
```

### 2. Frontend
```bash
cd frontend

# Install dependencies
npm install

# Configure environment
# Create .env.local with:
# NEXT_PUBLIC_CONTRACT_ADDRESS=0x392ea3e652f436583514c2aa62761a558c6af9b0

# Run development server
npm run dev
```

---

## 📡 Deployment Data

- **Chain ID**: `5042002` (Arc Testnet)
- **Contract Address**: `0x392ea3e652f436583514c2aa62761a558c6af9b0`
- **Explorer**: [testnet.arcscan.app](https://testnet.arcscan.app)
- **Vercel Demo**: [flowfi-three.vercel.app](https://flowfi-three.vercel.app/)

---

## 📜 License

MIT © 2026 FlowFi Team
