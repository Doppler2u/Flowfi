# FlowFi — Brutalist Programmable Payment Hub

![FlowFi Dashboard](./frontend/public/screenshot.png)

> A high-impact, polished smart contract + web dashboard deployed on **Arc Testnet** (Circle's Layer-1 blockchain).

FlowFi combines **pay-to-access content**, **usage-based credit spending**, and **advanced split payment routing** into a single on-chain payment hub, now featuring **native cross-chain liquidity bridging** via Circle App Kit and **Dual Theme support**.

---

## 🎨 Design Philosophy: Refined Brutalism
FlowFi utilizes a **Refined Brutalist Design System** characterized by stark functionality and high visual impact:
- **🌓 Dual Theme Support**: Seamlessly toggle between a sleek **Dark Mode** and a high-contrast **Light Mode** (Newsprint style).
- **Hard Edges**: Zero border-radius; thick, unyielding borders.
- **Contextual Documentation**: Integrated **Toolkit Icons** (InfoTooltips) across every tile to explain complex on-chain logic in plain English.
- **Data-First Typography**: `Space Grotesk` for headings and `Space Mono` for all data fields and inputs.

---

## 🚀 Live Deployment

| Detail | Value |
|---|---|
| **Network** | Arc Testnet |
| **Chain ID** | `5042002` |
| **Contract** | [`0x392ea3e652f436583514c2aa62761a558c6af9b0`](https://testnet.arcscan.app/address/0x392ea3e652f436583514c2aa62761a558c6af9b0) |
| **Explorer** | [testnet.arcscan.app](https://testnet.arcscan.app) |
| **RPC** | `https://rpc.testnet.arc.network` |

---

## ✨ Key Features & Real-World Use Cases

### 🌉 Liquidity Bridge (Circle App Kit)
Seamlessly transfer native USDC liquidity from **Ethereum Sepolia** directly into your **Arc Testnet** account via Circle CCTP.
- **Native Wallet Integration**: Connect MetaMask and bridge in one click.
- **1:1 Native Swaps**: Burn-and-mint mechanism ensures zero slippage and preserved value.

### 📦 Content Marketplace
An atomic pay-to-access marketplace for digital assets.
- **Registry & Library**: Creators register content; users unlock it using their contract balance.
- **Atomic Access**: On-chain verification ensures access is only granted upon successful USDC payment.
- **Experimental Guardrails**: Built-in advisory for decentralized arbitration strategies.

### 🔀 Programmable Routing & Usage
- **Usage Credits**: Developers can deduct credits for API calls or on-chain services.
  - *Use Cases*: AI Agent prompts, SaaS usage-based billing, Premium API keys.
- **Payment Router**: Split payments atomically between multiple recipients with configurable percentage splits.
  - *Use Cases*: Revenue sharing, automated tax withholding, affiliate payouts.

---

## 🔧 Tech Stack

**Smart Contract (Foundry Environment)**
- Solidity `^0.8.20`
- Foundry (forge, cast, anvil)

**Frontend (Next.js Framework)**
- **UI**: Next.js (App Router), Tailwind CSS v4, Lucide React
- **Integration**: Viem v2, Wagmi
- **Circle SDKs**: `@circle-fin/app-kit`, `@circle-fin/adapter-viem-v2`

---

## 🛠️ Local Development

### Prerequisites
- [Foundry](https://getfoundry.sh/) (via WSL on Windows)
- Node.js 22+
- MetaMask browser extension

### Smart Contract
```bash
# Navigate to project
cd flowfi

# Build
forge build

# Run tests
forge test -vvv
```

### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:3000
```

---

## ⚙️ Environment Variables

### Smart Contract (`.env` in root)
```ini
ARC_TESTNET_RPC_URL="https://rpc.testnet.arc.network"
PRIVATE_KEY="your_private_key"
```

### Frontend (`frontend/.env.local`)
```ini
NEXT_PUBLIC_CONTRACT_ADDRESS=0x392ea3e652f436583514c2aa62761a558c6af9b0
```

---

## 📜 License

MIT
