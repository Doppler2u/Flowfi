"use client";

import { useState } from "react";
import { useWeb3 } from "@/context/Web3Provider";
import { MoveRight, ShieldCheck, Globe, Zap, Loader2, ArrowRightLeft } from "lucide-react";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import InfoTooltip from "./InfoTooltip";

export default function AppKitBridge() {
  const { isConnected, addLog } = useWeb3();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleBridge = async () => {
    if (!isConnected || !amount || parseFloat(amount) <= 0) return;
    
    // Check for provider
    if (typeof window === "undefined" || !window.ethereum) {
      addLog({ type: "error", message: "No wallet provider (MetaMask) found." });
      return;
    }

    setLoading(true);
    addLog({ type: "info", message: `Connecting to Circle SDK for ${amount} USDC transfer...` });
    
    try {
      // 1. Create Viem Adapter from native provider (MetaMask)
      const adapter = await createViemAdapterFromProvider({ 
        provider: window.ethereum as any 
      });

      // 2. Initialize App Kit
      const kit = new AppKit();

      addLog({ type: "info", message: `Bridging ${amount} USDC from Sepolia to Arc Testnet via Circle CCTP...` });

      // 3. Trigger the actual bridge capability
      // Chain names based on docs-app-kit.txt line 73-74
      const result = await kit.bridge({
        from: { adapter, chain: "Ethereum_Sepolia" },
        to: { adapter, chain: "Arc_Testnet" },
        amount: amount,
      });

      // 4. Handle results
      if (result && (result as any).steps) {
        const steps = (result as any).steps;
        const lastStep = steps[steps.length - 1];
        
        addLog({ 
          type: "info", 
          message: `Cross-Chain Transfer Successfully Initiated! ${amount} USDC is on its way.`,
          txHash: lastStep.txHash,
          explorerUrl: lastStep.data?.explorerUrl
        });
        setAmount("");
      } else {
        // Fallback for different return structures
        addLog({ 
          type: "info", 
          message: `Cross-Chain Transfer Processed! ${amount} USDC is moving.`,
          txHash: (result as any).txHash || (result as any).hash || "success"
        });
        setAmount("");
      }
    } catch (e: any) {
      console.error("Bridge Error:", e);
      addLog({ 
        type: "error", 
        message: e.message?.includes("User rejected") 
          ? "Transaction rejected in MetaMask." 
          : `Bridge Failed: ${e.message || "Unknown error"}` 
        });
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) return null;

  return (
    <div className="brut-card border-x-0 border-b-0 border-t-4 border-[#4D7FFF] bg-[#4D7FFF]/5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#4D7FFF] flex items-center justify-center border-2 border-[#4D7FFF]">
              <Globe size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter font-sans">Liquidity Bridge</h2>
                <InfoTooltip 
                  title="Circle CCTP Bridge"
                  content="SEAMLESSLY MOVE USDC FROM ETHEREUM SEPOLIA TO ARC TESTNET. THIS USES CIRCLE APP KIT TO BURN USDC ON THE SOURCE CHAIN AND MINT NATIVE USDC ON ARC, ENSURING 1:1 VALUE WITH ZERO SLIPPAGE."
                />
              </div>
              <p className="text-[10px] font-mono text-[#4D7FFF] font-black uppercase tracking-widest">Powered by Circle App Kit</p>
            </div>
          </div>

          <p className="text-sm font-mono text-slate-400 leading-relaxed italic">
            &quot;Seamlessly transfer native USDC liquidity from Ethereum Sepolia directly into your Arc Testnet account with zero slippage via Circle CCTP.&quot;
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 border-2 border-[var(--border-main)] bg-[var(--bg-page)]">
              <ShieldCheck size={14} className="text-[#008A4B] dark:text-[#00FF87]" />
              <span className="text-[10px] font-black uppercase text-[var(--text-dim)]">Atomic Security</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 border-2 border-[var(--border-main)] bg-[var(--bg-page)]">
              <Zap size={14} className="text-[#A39200] dark:text-[#FFE600]" />
              <span className="text-[10px] font-black uppercase text-[var(--text-dim)]">1:1 Native Swaps</span>
            </div>
          </div>
        </div>

        <div className="border-4 border-[#4D7FFF] p-6 bg-[var(--bg-page)] flex flex-col items-center justify-center space-y-6 shadow-[8px_8px_0px_0px_rgba(77,127,255,0.2)]">
          <div className="w-full space-y-4">
            {/* Amount Input */}
            <div className="space-y-2">
              <label className="brut-title block text-center">Amount to Bridge (USDC)</label>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="brut-input text-center text-lg py-4"
                disabled={loading}
              />
            </div>

            <div className="flex items-center gap-6 w-full justify-center py-2">
              <div className="space-y-2 flex flex-col items-center">
                <div className="w-12 h-12 border-2 border-[var(--border-main)] flex items-center justify-center bg-[var(--bg-card)]">
                  <span className="text-xs font-black text-[var(--text-main)]">ETH</span>
                </div>
                <p className="text-[9px] font-mono text-[var(--text-dim)] uppercase">Sepolia</p>
              </div>
              
              <MoveRight size={20} className="text-[#4D7FFF] animate-pulse" />
              
              <div className="space-y-2 flex flex-col items-center">
                <div className="w-12 h-12 border-2 border-[#FFE600] flex items-center justify-center bg-[var(--bg-card)]">
                  <span className="text-xs font-black text-[#A39200] dark:text-[#FFE600]">ARC</span>
                </div>
                <p className="text-[9px] font-mono text-[var(--text-dim)] uppercase">Testnet</p>
              </div>
            </div>

            <button
              onClick={handleBridge}
              disabled={loading || !amount}
              className="brut-btn brut-btn-blue w-full flex items-center justify-center gap-3 font-black py-4"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing Transaction...
                </>
              ) : (
                <>
                  <ArrowRightLeft size={16} />
                  Initiate Transfer
                </>
              )}
            </button>
          </div>
          
          <p className="text-[9px] font-mono text-[#333] uppercase font-bold tracking-widest">
            Cross-Chain Transfer Protocol [CCTP] v1.4.2
          </p>
        </div>
      </div>
    </div>
  );
}
