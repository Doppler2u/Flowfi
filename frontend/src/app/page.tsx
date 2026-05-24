"use client";

import WalletConnect from "@/components/WalletConnect";
import DepositWithdrawPanel from "@/components/DepositWithdrawPanel";
import ContentMarketplace from "@/components/ContentMarketplace";
import AppKitBridge from "@/components/AppKitBridge";
import CreatorPanel from "@/components/CreatorPanel";
import ActivityLog from "@/components/ActivityLog";
import ThemeToggle from "@/components/ThemeToggle";
import { FlowFiABI, CONTRACT_ADDRESS } from "@/lib/abi";
import { HelpCircle, Shield, Zap, Brain, Lock, Network, Coins, ArrowDownRight, Terminal } from "lucide-react";
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
          <div className="py-12 sm:py-20 space-y-24">
            
            {/* Hero Section */}
            <div className="text-center space-y-8 px-4">
              <div className="inline-block border-2 border-[#FFE600] bg-[#FFE600]/10 px-4 py-2 mb-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-[#FFE600] flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#FFE600] animate-pulse"></span>
                  System Online
                </p>
              </div>
              <h2 className="text-5xl sm:text-7xl lg:text-8xl font-black text-[var(--text-main)] leading-[0.9] uppercase tracking-tighter" style={{fontFamily: 'Space Grotesk'}}>
                Programmable<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFE600] via-[#00FF87] to-[#00D9FF]">
                  Monetization
                </span>
              </h2>
              <p className="mt-6 text-[var(--text-dim)] text-base sm:text-lg max-w-2xl mx-auto font-mono">
                A programmable payment hub on Arc Testnet. Stake tokens, purchase encrypted content, and resolve disputes using autonomous AI arbitration.
              </p>
            </div>

            {/* Architecture Banner */}
            <div className="border-y-2 border-[var(--border-main)] bg-[var(--bg-card)] overflow-hidden py-4">
              <div className="animate-marquee flex items-center gap-8 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--text-dim)]">
                {Array(6).fill("ARC TESTNET // GENLAYER AI // LIT PROTOCOL // PINATA IPFS // CIRCLE CCTP // ").map((text, i) => (
                  <span key={i} className="shrink-0">{text}</span>
                ))}
              </div>
            </div>

            {/* Feature Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-12 border-l-4 border-[#00FF87] pl-4">
                <h3 className="text-2xl font-black uppercase tracking-tight" style={{fontFamily: 'Space Grotesk'}}>Core Infrastructure</h3>
                <p className="text-xs font-mono text-[var(--text-dim)] mt-2">Module diagnostics active</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { icon: Zap, label: "01", title: "Arc Testnet", desc: "High-speed, low-cost programmable transactions ensuring smooth execution of payment streams and stakes.", color: "#FFE600" },
                  { icon: Lock, label: "02", title: "Lit Protocol", desc: "Mathematically gated content decryption. Data is only decrypted when the smart contract verifies proof of payment.", color: "#00D9FF" },
                  { icon: Brain, label: "03", title: "GenLayer AI", desc: "Intelligent dispute resolution. If content quality is contested, the GenLayer AI agent autonomously reviews the encrypted data and issues a verdict.", color: "#00FF87" },
                  { icon: Shield, label: "04", title: "Trustless Escrow", desc: "Funds are locked in the smart contract until the transaction is finalized or disputed. No centralized intermediaries.", color: "#FF3366" },
                  { icon: Coins, label: "05", title: "Creator Staking", desc: "Creators stake tokens to list content. Quality is incentivized as bad actors lose their stake upon AI dispute resolution.", color: "#B300FF" },
                  { icon: Network, label: "06", title: "CCTP Bridge", desc: "Seamless liquidity transfer across networks using Circle's Cross-Chain Transfer Protocol integration.", color: "#4D7FFF" },
                ].map((f, i) => (
                  <div key={i} className="group relative">
                    <div className="absolute inset-0 bg-transparent border-2 border-[var(--border-main)] translate-x-2 translate-y-2 transition-transform group-hover:translate-x-3 group-hover:translate-y-3" style={{borderColor: f.color, opacity: 0.3}}></div>
                    <div className="relative h-full border-2 border-[var(--border-main)] bg-[var(--bg-page)] p-6 transition-colors hover:bg-[var(--bg-card)] flex flex-col">
                      <div className="flex justify-between items-start mb-6">
                        <f.icon className="w-8 h-8" style={{color: f.color}} />
                        <span className="text-[10px] font-mono border-b border-[var(--border-main)] pb-1" style={{color: f.color}}>{f.label}</span>
                      </div>
                      <h4 className="text-lg font-black uppercase mb-3 font-sans" style={{color: "var(--text-main)"}}>{f.title}</h4>
                      <p className="text-xs font-mono text-[var(--text-dim)] leading-relaxed flex-grow">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
               <div className="border-2 border-[var(--border-main)] p-8 sm:p-12 relative overflow-hidden bg-[var(--bg-card)]">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                   <ArrowDownRight className="w-32 h-32 text-[var(--text-main)]" />
                 </div>
                 
                 <h3 className="text-3xl font-black uppercase mb-12 relative z-10" style={{fontFamily: 'Space Grotesk'}}>Execution Flow</h3>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 relative z-10">
                   {[
                     { step: "01", title: "Deposit", text: "Fund your wallet with test USDC." },
                     { step: "02", title: "Purchase", text: "Buy encrypted content. Funds enter escrow." },
                     { step: "03", title: "Unlock", text: "Lit Protocol decrypts Pinata IPFS hash." },
                     { step: "04", title: "Settle", text: "Finalize payment or trigger AI Arbitration." },
                   ].map((s, i) => (
                     <div key={i} className="relative">
                       {i < 3 && <div className="hidden sm:block absolute top-4 left-[3rem] w-[calc(100%-3rem)] h-[2px] bg-[var(--border-main)] -z-10"></div>}
                       <div className="w-8 h-8 bg-[#FFE600] text-black font-bold font-mono text-xs flex items-center justify-center mb-4 border border-[#FFE600]">
                         {s.step}
                       </div>
                       <h5 className="font-bold uppercase text-sm mb-2">{s.title}</h5>
                       <p className="text-[10px] font-mono text-[var(--text-dim)] pr-4">{s.text}</p>
                     </div>
                   ))}
                 </div>
               </div>
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
                <CreatorPanel />
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
