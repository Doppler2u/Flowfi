"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useWeb3 } from "@/context/Web3Provider";
import { FlowFiABI, CONTRACT_ADDRESS } from "@/lib/abi";
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import InfoTooltip from "./InfoTooltip";

export default function DepositWithdrawPanel() {
  const { address, isConnected, walletClient, publicClient, addLog, refreshBalance, contractBalance, walletBalance } = useWeb3();
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [loadingWithdraw, setLoadingWithdraw] = useState(false);

  const isDepositExceeds = parseFloat(depositAmt || "0") > parseFloat(walletBalance || "0");
  const isWithdrawExceeds = parseFloat(withdrawAmt || "0") > parseFloat(contractBalance || "0");

  const handleDeposit = async () => {
    if (!walletClient || !publicClient || !address || !depositAmt) return;
    if (parseFloat(depositAmt) > parseFloat(walletBalance)) {
      addLog({ type: "error", message: `Insufficient wallet balance. You have ${parseFloat(walletBalance).toFixed(4)} USDC.` });
      return;
    }
    setLoadingDeposit(true);
    try {
      const value = parseUnits(depositAmt, 18);
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "deposit",
        value,
        account: address as `0x${string}`,
        chain: null,
      });
      addLog({ type: "deposit", message: `Deposited ${depositAmt} USDC`, txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshBalance();
      setDepositAmt("");
    } catch (e: any) {
      addLog({ type: "error", message: `Deposit failed: ${e.shortMessage || e.message}` });
    } finally {
      setLoadingDeposit(false);
    }
  };

  const handleWithdraw = async () => {
    if (!walletClient || !publicClient || !address || !withdrawAmt) return;
    if (parseFloat(withdrawAmt) > parseFloat(contractBalance)) {
      addLog({ type: "error", message: `Insufficient FlowFi balance. You have ${parseFloat(contractBalance).toFixed(4)} USDC.` });
      return;
    }
    setLoadingWithdraw(true);
    try {
      const amount = parseUnits(withdrawAmt, 18);
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "withdraw",
        args: [amount],
        account: address as `0x${string}`,
        chain: null,
      });
      addLog({ type: "withdraw", message: `Withdrew ${withdrawAmt} USDC`, txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshBalance();
      setWithdrawAmt("");
    } catch (e: any) {
      addLog({ type: "error", message: `Withdraw failed: ${e.shortMessage || e.message}` });
    } finally {
      setLoadingWithdraw(false);
    }
  };

  const isDisabled = !isConnected;

  return (
    <div className="brut-card space-y-5">
      <div className="flex items-center gap-3 border-b-2 border-[var(--border-main)] pb-3">
        <div className="w-2 h-6 bg-[#00FF87]" />
        <div className="flex items-center gap-1.5 flex-1">
          <h2 className="brut-title select-none text-[#008A4B] dark:text-[#00FF87]">Deposit / Withdraw</h2>
          <InfoTooltip 
            title="Liquidity Management"
            content="DEPOSIT USDC INTO THE FLOWFI CONTRACT TO ENABLE PROGRAMMABLE FEATURES. THIS CREATES AN ON-CHAIN BALANCE THAT CAN BE ROUTED, SPENT ON SERVICES, OR USED TO UNLOCK CONTENT."
          />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[var(--border-main)] bg-[var(--bg-page)]/50">
        <p className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-widest mb-1">On-Chain Balance</p>
        <p className="text-3xl sm:text-5xl font-black text-[#00FF87] tracking-tighter tabular-nums truncate max-w-full">
          {parseFloat(contractBalance).toFixed(2)}
        </p>
        <p className="text-[9px] font-mono text-[#008A4B] mt-1 uppercase font-bold">Stable USDC</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black uppercase text-[var(--text-dim)] flex items-center gap-1.5">
              <ArrowDownCircle size={10} /> Deposit
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={depositAmt}
                onChange={(e) => setDepositAmt(e.target.value)}
                className="brut-input w-full text-xl sm:text-2xl font-black pr-12 font-mono"
                disabled={loadingDeposit || isDisabled}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--text-dim)]">USDC</span>
            </div>
            <p className="text-[9px] font-mono text-[var(--text-dim)]">Wallet: {parseFloat(walletBalance).toFixed(2)}</p>
            <button
              onClick={handleDeposit}
              disabled={isDisabled || !depositAmt || loadingDeposit || isDepositExceeds}
              className="brut-btn brut-btn-green w-full justify-center"
            >
              {loadingDeposit ? <Loader2 size={12} className="animate-spin" /> : <ArrowDownCircle size={12} />}
              Deposit
            </button>
          </div>

          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black uppercase text-[var(--text-dim)] flex items-center gap-1.5">
              <ArrowUpCircle size={10} /> Withdraw
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={withdrawAmt}
                onChange={(e) => setWithdrawAmt(e.target.value)}
                className="brut-input w-full text-xl sm:text-2xl font-black pr-12 font-mono"
                disabled={loadingWithdraw || isDisabled}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--text-dim)]">USDC</span>
            </div>
            <p className="text-[9px] font-mono text-[var(--text-dim)]">Max: {parseFloat(contractBalance).toFixed(2)}</p>
            <button
              onClick={handleWithdraw}
              disabled={isDisabled || !withdrawAmt || loadingWithdraw || isWithdrawExceeds}
              className="brut-btn brut-btn-red w-full justify-center"
            >
              {loadingWithdraw ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpCircle size={12} />}
              Withdraw
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
