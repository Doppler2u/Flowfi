# FlowFi 🌊
### Decentralized Trust & Privacy Marketplace on Arc Network

**FlowFi** is a state-of-the-art Web3 platform designed to facilitate secure, encrypted, and trustless digital asset trading. It leverages the **Arc Testnet** for high-speed transactions, **Lit Protocol** for autonomous privacy gating, and **GenLayer** for decentralized AI dispute arbitration.

![FlowFi Dashboard](./frontend/public/screenshot.png)

---

## 🏆 Key Features & Architecture

### 1. 🛡️ Trustless Escrow & Economic Security
FlowFi eliminates "friendly fraud" through rigorous economic protocols:
- **24-Hour Dispute Window**: Payments are locked in escrow upon purchase. If a buyer receives a dead link or invalid payload, they can raise a dispute, freezing the funds.
- **Security Deposits**: Raising a dispute requires a 2 USDC deposit. This forces buyers to put "skin in the game," eliminating spam reports.
- **Creator Staking**: Content creators must stake a minimum of 5 USDC collateral in the protocol. Verified status prevents low-quality spam rings. Collateral is slashable in cases of verified fraud.

### 2. 🤫 Mathematical Privacy (Lit Protocol)
Data is not just token-gated; it is cryptographically locked:
- **Client-Side Encryption**: Secrets are encrypted locally in the browser before ever touching the network via the `@lit-protocol/lit-node-client`.
- **Autonomous Gating**: The encrypted ciphertext is hosted on IPFS. Decentralized Lit nodes will only decrypt the content if the requesting wallet holds the specific ERC-1155 Access NFT on the Arc Testnet.

### 3. 🛡️ Bulletproof Sync Engine
Most dApps rely on fragile RPC indexing that often breaks due to block limits. FlowFi implements an adaptive **RPC Fallback Scanner**:
- **Smart Range Scanning**: Dynamically pulls up to 9,500 blocks backward from the chain tip to prevent `413 Range Errors`.
- **Race Condition Shield**: Implements a 10-block buffer to handle out-of-sync RPC nodes.

### 4. 🎨 Refined Brutalist UX
A visual identity that matches the precision of the code:
- **Zero-Radius Design**: Stark, hard edges and thick borders for high-impact readability.
- **Dual-Theme Engine**: Sleek **Dark Mode** and high-contrast **Newsprint Light Mode**.
- **Real-Time Telemetry**: An Activity Log provides transparent system feedback on every node handshake and block scan.

---

## 🚀 Technical Stack

- **L1 Blockchain**: Arc Testnet (RPC: `rpc.testnet.arc.network`)
- **Privacy Engine**: Lit Protocol (`datil` network)
- **AI Arbitration**: GenLayer Studionet (GenVM Intelligent Contracts)
- **Oracle Bridge**: Node.js Relayer (deployed on Render)
- **Frontend**: Next.js 15 (App Router), Tailwind CSS v4, Viem v2
- **Data Layer**: IPFS (via Pinata) for permissionless metadata storage
- **Design**: Refined Brutalism (Space Grotesk & Space Mono)

---

## 🤖 Phase 3: Autonomous AI Arbitration (Live)
FlowFi has successfully integrated the **GenLayer Network** to completely decentralize the dispute resolution process, eliminating the need for a central administrator.
- **GenVM Intelligent Contracts**: When a dispute is raised, a Python contract (`FlowFiArbiter.py`) executing on GenLayer's Studionet automatically evaluates the disputed content metadata using multiple LLM validators.
- **Oracle Bridge**: A Node.js Relayer deployed on Render automatically pipes `DisputeRaised` events from the Arc Testnet to GenLayer, and routes verdicts back to settle funds.
- **Optimistic AI Consensus**: Multiple LLMs act as independent jurors on GenLayer. They analyze the IPFS metadata and delivery URL, reach consensus on whether the transaction was a "Creator Scam" or "Buyer Fraud", and automatically execute the refund via the Oracle Bridge back on the Arc Testnet.

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

# Configure environment (.env.local)
NEXT_PUBLIC_CONTRACT_ADDRESS="0x348cedA90058232b63ccFE1514B2cfbdcecb6e56"
PINATA_JWT="your_pinata_jwt"

# Run development server
npm run dev
```

### 3. Relayer (Oracle Bridge)
```bash
cd relayer

# Install dependencies
npm install

# Configure environment (.env)
PRIVATE_KEY="your_private_key"
FLOWFI_CONTRACT_ARC="0x348cedA90058232b63ccFE1514B2cfbdcecb6e56"
ARBITER_CONTRACT_GENLAYER="0x06E4B36E19dB89A821d0F852868E868f992Dd0e4"

# Deploy GenLayer contract (only needed if redeploying)
node deploy.js

# Start the relayer
node relayer.js
```

---

## 📡 Deployment Data

| Component | Network | Address |
|-----------|---------|---------|
| **FlowFi Contract** | Arc Testnet (Chain ID: `5042002`) | `0x348cedA90058232b63ccFE1514B2cfbdcecb6e56` |
| **FlowFiArbiter** | GenLayer Studionet | `0x06E4B36E19dB89A821d0F852868E868f992Dd0e4` |
| **Relayer** | Render (Cloud) | Auto-deployed via GitHub + Keep-Alive via cron-job.org |

- **Arc Explorer**: [testnet.arcscan.app](https://testnet.arcscan.app)
- **GenLayer Explorer**: [studio.genlayer.com](https://studio.genlayer.com)

---

## 📜 License

MIT © 2026 FlowFi Team
