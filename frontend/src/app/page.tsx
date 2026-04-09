"use client";

import WalletConnect from "@/components/WalletConnect";
import DepositWithdrawPanel from "@/components/DepositWithdrawPanel";
import ContentMarketplace from "@/components/ContentMarketplace";
import AppKitBridge from "@/components/AppKitBridge";
import UsagePanel from "@/components/UsagePanel";
import ActivityLog from "@/components/ActivityLog";
import ThemeToggle from "@/components/ThemeToggle";
import { FlowFiABI, CONTRACT_ADDRESS } from "@/lib/abi";
import { HelpCircle } from "lucide-react";
import InfoTooltip from "@/components/InfoTooltip";
import { useWeb3 } from "@/context/Web3Provider";

export default function Home() {
  const { isConnected, contractBalance } = useWeb3();

  return (
    <div className="min-h-screen bg-[var(--bg-page)] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-center sm:items-end justify-between py-6 sm:py-8 gap-5 border-b-2 border-[#FFE600]">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-start">
            <div className="w-12 h-12 bg-[#FFE600] flex items-center justify-center border-2 border-[#FFE600] shrink-0">
              <span className="text-black font-black text-xl" style={{fontFamily:'Space Grotesk'}}>F</span>
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-black text-[var(--text-main)] tracking-tight font-sans">FLOWFI</h1>
              <p className="text-[10px] text-[var(--text-dim)] font-mono uppercase tracking-widest break-words max-w-[200px] sm:max-w-none">Programmable Payment Hub · Arc Testnet</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-[var(--bg-card)] p-2 sm:bg-transparent sm:p-0 border-2 border-[var(--border-main)] sm:border-0 grow sm:grow-0 justify-center">
            <InfoTooltip 
              title="Road to Production"
              content={(
                <div className="space-y-4">
                  <div className="border-b border-[#FFE600]/20 pb-2 text-[10px]">
                    <p className="text-[#FFE600] font-black tracking-widest mb-1">01. DATA RESILIENCE</p>
                    <p>MIGRATE FROM LOCALSTORAGE TO IPFS + SUPABASE FOR CROSS-DEVICE METADATA PERSISTENCE.</p>
                  </div>
                  <div className="border-b border-[#FFE600]/20 pb-2 text-[10px]">
                    <p className="text-[#FFE600] font-black tracking-widest mb-1">02. PRIVACY ENGINE</p>
                    <p>IMPLEMENT ZK-PROOFS OR LIT PROTOCOL FOR MATHEMATICALLY GATED CONTENT DECRYPTION.</p>
                  </div>
                  <div className="border-b border-[#FFE600]/20 pb-2 text-[10px]">
                    <p className="text-[#FFE600] font-black tracking-widest mb-1">03. PERFORMANCE</p>
                    <p>LEVERAGE SUBGRAPHS (THE GRAPH) FOR INDEXED, HIGH-SPEED EVENT TRACKING ON ARC NETWORK.</p>
                  </div>
                  <div className="text-[10px]">
                    <p className="text-[#FFE600] font-black tracking-widest mb-1">04. MAINNET READY</p>
                    <p>FORMAL SMART CONTRACT AUDITS AND MULTI-SIGNATURE TREASURY CONTROLS FOR INSTITUTIONAL USE.</p>
                  </div>
                </div>
              )}
            />
            <ThemeToggle />
            <WalletConnect />
          </div>
        </header>

        {/* Stats bar */}
        {isConnected && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-0 border-2 border-[var(--border-main)]">
            {[
              { label: "Network", value: "Arc Testnet", color: "#00FF87" },
              { label: "Chain ID", value: "5042002", color: "var(--text-main)" },
              { label: "Contract", value: `${CONTRACT_ADDRESS.slice(0,8)}...`, color: "#FFE600" },
              { label: "FlowFi Balance", value: `${parseFloat(contractBalance).toFixed(4)} USDC`, color: "#00D9FF" },
            ].map((stat, i) => (
              <div key={stat.label} className={`px-4 py-3 bg-[var(--bg-card)] ${i < 3 ? "border-r-2 border-[var(--border-main)]" : ""}`}>
                <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-dim)]">{stat.label}</p>
                <p className="text-sm font-bold mt-0.5 font-mono" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Main content */}
        {!isConnected ? (
          <div className="py-20 text-center space-y-12">
            <div className="space-y-4 px-4">
              <h2 className="text-4xl sm:text-6xl font-black text-[var(--text-main)] leading-none uppercase" style={{fontFamily: 'Space Grotesk'}}>
                Protocol<br/>Initialized
              </h2>
              <p className="mt-3 text-[var(--text-dim)] text-sm max-w-md mx-auto font-mono">
                Connect your MetaMask wallet to access the programmable payment hub on Arc Testnet.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto text-left px-4">
              {[
                { label: "01", title: "Deposit / Withdraw", desc: "Manage your USDC balance", color: "#00FF87" },
                { label: "02", title: "Content Market", desc: "Experimental architecture", color: "#FFE600" },
                { label: "03", title: "Usage Credits", desc: "Pay-per-use model", color: "#FF3B3B" },
                { label: "04", title: "Payment Router", desc: "Split payments on-chain", color: "#00D9FF" },
              ].map((f) => (
                <div key={f.title} className="border-2 p-4 bg-[var(--bg-card)]/5" style={{borderColor: f.color}}>
                  <p className="text-[10px] font-mono mb-2" style={{color: f.color}}>{f.label}</p>
                  <p className="text-xs font-bold text-[var(--text-main)] uppercase font-sans">{f.title}</p>
                  <p className="text-[10px] text-[var(--text-dim)] mt-1 font-mono">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <main className="mt-6 pb-12 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column */}
              <div className="flex flex-col gap-6 h-full lg:order-1">
                <DepositWithdrawPanel />
                <ActivityLog />
              </div>

              {/* Middle column */}
              <div className="flex flex-col gap-6 h-full lg:order-2">
                <ContentMarketplace />
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-6 h-full lg:order-3">
                <UsagePanel />
              </div>
            </div>
            
            {/* Full-width Bottom Row - App Kit Bridge */}
            <div className="w-full pt-4">
              <AppKitBridge />
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
