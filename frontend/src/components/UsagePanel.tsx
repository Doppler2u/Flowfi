"use client";

import { useState } from "react";
import { parseUnits, isAddress } from "viem";
import { useWeb3 } from "@/context/Web3Provider";
import { FlowFiABI, CONTRACT_ADDRESS } from "@/lib/abi";
import { Zap, GitFork, Loader2, Wrench } from "lucide-react";
import InfoTooltip from "./InfoTooltip";

export default function UsagePanel() {
  const { address, isConnected, walletClient, publicClient, addLog, refreshBalance, contractBalance } = useWeb3();

  const [serviceAmt, setServiceAmt] = useState("");
  const [loadingService, setLoadingService] = useState(false);
  const isServiceExceeds = parseFloat(serviceAmt || "0") > parseFloat(contractBalance || "0");

  const [routeAmt, setRouteAmt] = useState("");
  const [primaryRecipient, setPrimaryRecipient] = useState("");
  const [secondaryRecipient, setSecondaryRecipient] = useState("");
  const [splitPercent, setSplitPercent] = useState("80");
  const [loadingRoute, setLoadingRoute] = useState(false);
  const isRouteExceeds = parseFloat(routeAmt || "0") > parseFloat(contractBalance || "0");

  const handleUseService = async () => {
    if (!walletClient || !publicClient || !serviceAmt) return;
    if (parseFloat(serviceAmt) > parseFloat(contractBalance)) {
      addLog({ type: "error", message: `Insufficient FlowFi balance. You have ${parseFloat(contractBalance).toFixed(4)} USDC.` });
      return;
    }
    setLoadingService(true);
    try {
      const cost = parseUnits(serviceAmt, 18);
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "useService",
        args: [cost],
        account: address as `0x${string}`,
        chain: null,
      });
      addLog({ type: "service", message: `Used service — spent ${serviceAmt} USDC`, txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshBalance();
      setServiceAmt("");
    } catch (e: any) {
      addLog({ type: "error", message: `Service failed: ${e.shortMessage || e.message}` });
    } finally {
      setLoadingService(false);
    }
  };

  const handleRoutePayment = async () => {
    if (!walletClient || !publicClient || !routeAmt || !primaryRecipient || !secondaryRecipient) return;
    if (!isAddress(primaryRecipient) || !isAddress(secondaryRecipient)) {
      addLog({ type: "error", message: "Invalid recipient address(es)" });
      return;
    }
    if (parseFloat(routeAmt) > parseFloat(contractBalance)) {
      addLog({ type: "error", message: `Insufficient FlowFi balance. You have ${parseFloat(contractBalance).toFixed(4)} USDC.` });
      return;
    }
    setLoadingRoute(true);
    try {
      const amount = parseUnits(routeAmt, 18);
      const route = {
        primaryRecipient: primaryRecipient as `0x${string}`,
        secondaryRecipient: secondaryRecipient as `0x${string}`,
        splitPercent: BigInt(splitPercent),
      };
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "routePayment",
        args: [amount, route],
        account: address as `0x${string}`,
        chain: null,
      });
      addLog({
        type: "route",
        message: `Routed ${routeAmt} USDC — ${splitPercent}% to primary, ${100 - parseInt(splitPercent)}% to secondary`,
        txHash: hash,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshBalance();
      setRouteAmt("");
    } catch (e: any) {
      addLog({ type: "error", message: `Route failed: ${e.shortMessage || e.message}` });
    } finally {
      setLoadingRoute(false);
    }
  };

  const isDisabled = !isConnected;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Use Service */}
      <div className="brut-card space-y-4">
        <div className="flex items-center gap-3 border-b-2 border-[var(--border-main)] pb-3">
          <div className="w-2 h-6 bg-[#FFE600]" />
          <div className="flex items-center gap-1.5">
            <Wrench size={12} className="text-[#A39200] dark:text-[#FFE600] shrink-0" />
            <h2 className="brut-title text-[#A39200] dark:text-[#FFE600] truncate">Usage Credits</h2>
            <InfoTooltip 
              title="Real-World Use Cases"
              content={(
                <div className="space-y-3">
                  <p>THIS SECTION POWERS A "PAY-AS-YOU-GO" MODEL DIRECTLY ON ARC TESTNET. USE CASES INCLUDE:</p>
                  <ul className="list-disc pl-4 space-y-1 text-[10px] text-[#FFE600]">
                    <li>AI AGENT ACCESS (PAY PER PROMPT)</li>
                    <li>SaaS BILLING (USAGE-BASED SUBSCRIPTIONS)</li>
                    <li>PREMIUM DATA FEEDS (UNLOCK REAL-TIME ALPHA)</li>
                    <li>API MONETIZATION (ON-CHAIN ACCESS KEYS)</li>
                  </ul>
                  <p className="border-t border-[#FFE600]/20 pt-2 text-[#888]">
                    DEDUCTS USDC FROM YOUR CONTRACT BALANCE AT A FIXED OR DYNAMIC RATE.
                  </p>
                </div>
              )}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="brut-title">Cost per call (USDC)</label>
          <div className="flex gap-0">
            <input
              id="service-cost-input"
              type="number"
              placeholder="0.0"
              min="0"
              step="0.0001"
              value={serviceAmt}
              onChange={(e) => setServiceAmt(e.target.value)}
              disabled={isDisabled}
              className={`brut-input flex-1 ${isServiceExceeds ? "error" : ""}`}
              style={{borderRight: 'none'}}
            />
            <button
              id="use-service-btn"
              onClick={handleUseService}
              disabled={isDisabled || !serviceAmt || loadingService || isServiceExceeds}
              className="brut-btn brut-btn-yellow shrink-0 px-4"
            >
              {loadingService ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Execute
            </button>
          </div>
          {isServiceExceeds && (
            <p className="text-[10px] text-[#FF3B3B] font-mono">// exceeds FlowFi balance ({parseFloat(contractBalance).toFixed(4)} USDC)</p>
          )}
        </div>
      </div>

      {/* Route Payment */}
      <div className="brut-card flex flex-col flex-1 space-y-4">
        <div className="flex items-center gap-3 border-b-2 border-[var(--border-main)] pb-3">
          <div className="w-2 h-6 bg-[#00D9FF]" />
          <div className="flex items-center gap-1.5 flex-1">
            <GitFork size={13} className="text-[#00879F] dark:text-[#00D9FF]" />
            <h2 className="brut-title text-[#00879F] dark:text-[#00D9FF] truncate">Payment Router</h2>
            <InfoTooltip 
              title="Split Payments"
              content="PROGRAMMATICALLY DIVIDE INCOMING USDC BETWEEN TWO RECIPIENTS. DEFINE THE SPLIT PERCENTAGE (E.G. 80/20) TO AUTOMATE REVENUE SHARING, TAXES, OR AFFILIATE FEES IN A SINGLE TRANSACTION."
            />
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <label className="brut-title">Total Amount (USDC)</label>
            <input
              id="route-amount-input"
              type="number"
              placeholder="0.001"
              value={routeAmt}
              onChange={(e) => setRouteAmt(e.target.value)}
              disabled={isDisabled}
              className={`brut-input ${isRouteExceeds ? "error" : ""}`}
            />
            {isRouteExceeds && (
              <p className="text-[10px] text-[#FF3B3B] font-mono">// exceeds FlowFi balance ({parseFloat(contractBalance).toFixed(4)} USDC)</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="brut-title">Primary Recipient</label>
            <input
              id="primary-recipient-input"
              type="text"
              placeholder="0x..."
              value={primaryRecipient}
              onChange={(e) => setPrimaryRecipient(e.target.value)}
              disabled={isDisabled}
              className="brut-input"
            />
          </div>

          <div className="space-y-2">
            <label className="brut-title">Secondary Recipient</label>
            <input
              id="secondary-recipient-input"
              type="text"
              placeholder="0x..."
              value={secondaryRecipient}
              onChange={(e) => setSecondaryRecipient(e.target.value)}
              disabled={isDisabled}
              className="brut-input"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="brut-title">Split to Primary</label>
              <span className="font-mono text-xs text-[#00879F] dark:text-[#00D9FF] font-bold">{splitPercent}% / {100 - parseInt(splitPercent || "0")}%</span>
            </div>
            <input
              id="split-percent-slider"
              type="range"
              min="0"
              max="100"
              value={splitPercent}
              onChange={(e) => setSplitPercent(e.target.value)}
              disabled={isDisabled}
              className="w-full accent-[#00D9FF] disabled:opacity-40"
              style={{height: '6px'}}
            />
            <div className="flex justify-between text-[9px] text-[#444] font-mono">
              <span>100% SEC</span>
              <span>50 / 50</span>
              <span>100% PRI</span>
            </div>
          </div>
        </div>

        <button
          id="route-payment-btn"
          onClick={handleRoutePayment}
          disabled={isDisabled || !routeAmt || !primaryRecipient || !secondaryRecipient || loadingRoute || isRouteExceeds}
          className="brut-btn brut-btn-cyan w-full mt-auto"
        >
          {loadingRoute ? <Loader2 size={13} className="animate-spin" /> : <GitFork size={13} />}
          Route Payment
        </button>
      </div>
    </div>
  );
}
