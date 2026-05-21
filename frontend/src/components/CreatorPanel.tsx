"use client";

import { useState, useEffect, useCallback } from "react";
import { parseUnits, formatUnits } from "viem";
import { useWeb3 } from "@/context/Web3Provider";
import { FlowFiABI, CONTRACT_ADDRESS } from "@/lib/abi";
import {
  Layers, ShieldCheck, PlusCircle, Wallet,
  Loader2, Unlock, ChevronDown, ChevronUp, Upload
} from "lucide-react";
import InfoTooltip from "./InfoTooltip";

const MIN_STAKE = 5; // 5 ETH

export default function CreatorPanel() {
  const {
    address, isConnected, walletClient, publicClient,
    addLog, walletBalance
  } = useWeb3();

  // ── State ─────────────────────────────────────────────────────────────────
  const [stakedBalance, setStakedBalance]   = useState("0");
  const [earnings, setEarnings]             = useState("0");
  const [stakeAmt, setStakeAmt]             = useState("");
  const [unstakeAmt, setUnstakeAmt]         = useState("");
  const [loadingStake, setLoadingStake]     = useState(false);
  const [loadingUnstake, setLoadingUnstake] = useState(false);

  // Create content form
  const [showCreate, setShowCreate]         = useState(false);
  const [contentId, setContentId]           = useState("");
  const [price, setPrice]                   = useState("");
  const [metadataUri, setMetadataUri]       = useState("");
  const [loadingCreate, setLoadingCreate]   = useState(false);

  // Payout release
  const [payoutContentId, setPayoutContentId] = useState("");
  const [payoutIndex, setPayoutIndex]         = useState("");
  const [loadingPayout, setLoadingPayout]     = useState(false);

  const isVerified = parseFloat(stakedBalance) >= MIN_STAKE;

  // ── Fetch on-chain data ───────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!publicClient || !address) return;
    try {
      const [staked, bal] = await Promise.all([
        publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: FlowFiABI,
          functionName: "stakedBalances",
          args: [address],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: FlowFiABI,
          functionName: "balances",
          args: [address],
        }) as Promise<bigint>,
      ]);
      setStakedBalance(formatUnits(staked, 18));
      setEarnings(formatUnits(bal, 18));
    } catch {}
  }, [publicClient, address]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Stake ─────────────────────────────────────────────────────────────────
  const handleStake = async () => {
    if (!walletClient || !publicClient || !stakeAmt) return;
    setLoadingStake(true);
    try {
      const value = parseUnits(stakeAmt, 18);
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "stake",
        value,
        account: address as `0x${string}`,
        chain: null,
      });
      addLog({ type: "info", message: `Staked ${stakeAmt} ETH as creator collateral`, txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
      setStakeAmt("");
    } catch (e: any) {
      addLog({ type: "error", message: `Stake failed: ${e.shortMessage || e.message}` });
    } finally {
      setLoadingStake(false);
    }
  };

  // ── Unstake ───────────────────────────────────────────────────────────────
  const handleUnstake = async () => {
    if (!walletClient || !publicClient || !unstakeAmt) return;
    setLoadingUnstake(true);
    try {
      const amount = parseUnits(unstakeAmt, 18);
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "unstake",
        args: [amount],
        account: address as `0x${string}`,
        chain: null,
      });
      addLog({ type: "info", message: `Unstaked ${unstakeAmt} ETH`, txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
      setUnstakeAmt("");
    } catch (e: any) {
      addLog({ type: "error", message: `Unstake failed: ${e.shortMessage || e.message}` });
    } finally {
      setLoadingUnstake(false);
    }
  };

  // ── Create Content ────────────────────────────────────────────────────────
  const handleCreateContent = async () => {
    if (!walletClient || !publicClient || !contentId || !price || !metadataUri) return;
    if (!isVerified) {
      addLog({ type: "error", message: `You must stake at least ${MIN_STAKE} ETH to create content.` });
      return;
    }
    setLoadingCreate(true);
    try {
      const priceWei = parseUnits(price, 18);
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "createContent",
        args: [BigInt(contentId), priceWei, metadataUri],
        account: address as `0x${string}`,
        chain: null,
      });
      addLog({ type: "info", message: `Content #${contentId} listed for ${price} ETH`, txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      setContentId(""); setPrice(""); setMetadataUri("");
      setShowCreate(false);
    } catch (e: any) {
      addLog({ type: "error", message: `Create failed: ${e.shortMessage || e.message}` });
    } finally {
      setLoadingCreate(false);
    }
  };

  // ── Release Payout ────────────────────────────────────────────────────────
  const handleReleasePayout = async () => {
    if (!walletClient || !publicClient || !payoutContentId || payoutIndex === "") return;
    setLoadingPayout(true);
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "releasePayout",
        args: [BigInt(payoutContentId), BigInt(payoutIndex)],
        account: address as `0x${string}`,
        chain: null,
      });
      addLog({ type: "info", message: `Payout released for Content #${payoutContentId}`, txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
      setPayoutContentId(""); setPayoutIndex("");
    } catch (e: any) {
      addLog({ type: "error", message: `Release failed: ${e.shortMessage || e.message}` });
    } finally {
      setLoadingPayout(false);
    }
  };

  if (!isConnected) return null;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Creator Status Card ─────────────────────────────────────────── */}
      <div className="brut-card space-y-4">
        <div className="flex items-center gap-3 border-b-2 border-[var(--border-main)] pb-3">
          <div className="w-2 h-6 bg-[#00D9FF]" />
          <div className="flex items-center gap-1.5 flex-1">
            <Layers size={13} className="text-[#00879F] dark:text-[#00D9FF] shrink-0" />
            <h2 className="brut-title text-[#00879F] dark:text-[#00D9FF]">Creator Panel</h2>
            <InfoTooltip
              title="Creator Verification"
              content="STAKE A MINIMUM OF 5 ETH AS COLLATERAL TO BECOME A VERIFIED CREATOR. THIS GIVES YOU SKIN IN THE GAME — FRAUDULENT CONTENT CAN RESULT IN STAKE SLASHING VIA AI ARBITRATION."
            />
          </div>
          {/* Verified badge */}
          <div className={`flex items-center gap-1.5 px-2 py-1 border-2 text-[9px] font-black uppercase ${
            isVerified
              ? "border-[#00FF87] text-[#00FF87] bg-[#00FF87]/10"
              : "border-[var(--border-main)] text-[var(--text-dim)]"
          }`}>
            <ShieldCheck size={10} />
            {isVerified ? "Verified" : "Unverified"}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 border-2 border-[var(--border-main)] bg-[var(--bg-page)]/50 space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-dim)]">Staked</p>
            <p className="text-xl font-black text-[#00D9FF] font-mono tabular-nums">
              {parseFloat(stakedBalance).toFixed(3)}
            </p>
            <p className="text-[9px] font-mono text-[#00879F]">ETH collateral</p>
          </div>
          <div className="p-3 border-2 border-[var(--border-main)] bg-[var(--bg-page)]/50 space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-dim)]">Earnings</p>
            <p className="text-xl font-black text-[#00FF87] font-mono tabular-nums">
              {parseFloat(earnings).toFixed(3)}
            </p>
            <p className="text-[9px] font-mono text-[#008A4B]">ETH claimable</p>
          </div>
        </div>

        {/* Stake / Unstake */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Stake ETH</label>
            <div className="flex gap-0">
              <input
                type="number" placeholder="5.0" value={stakeAmt}
                onChange={(e) => setStakeAmt(e.target.value)}
                className="brut-input flex-1 text-sm" style={{ borderRight: "none" }}
                disabled={loadingStake}
              />
              <button
                onClick={handleStake}
                disabled={!stakeAmt || loadingStake}
                className="brut-btn brut-btn-cyan shrink-0 px-3"
              >
                {loadingStake ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
              </button>
            </div>
            <p className="text-[9px] font-mono text-[var(--text-dim)]">
              Wallet: {parseFloat(walletBalance || "0").toFixed(3)} ETH · Min: {MIN_STAKE} ETH
            </p>
          </div>

          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Unstake ETH</label>
            <div className="flex gap-0">
              <input
                type="number" placeholder="0.0" value={unstakeAmt}
                onChange={(e) => setUnstakeAmt(e.target.value)}
                className="brut-input flex-1 text-sm" style={{ borderRight: "none" }}
                disabled={loadingUnstake}
              />
              <button
                onClick={handleUnstake}
                disabled={!unstakeAmt || loadingUnstake}
                className="brut-btn brut-btn-red shrink-0 px-3"
              >
                {loadingUnstake ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />}
              </button>
            </div>
            <p className="text-[9px] font-mono text-[var(--text-dim)]">
              Staked: {parseFloat(stakedBalance).toFixed(3)} ETH
            </p>
          </div>
        </div>
      </div>

      {/* ── List Content ────────────────────────────────────────────────── */}
      <div className="brut-card space-y-4">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="w-full flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-6 bg-[#FFE600]" />
            <div className="flex items-center gap-1.5">
              <Upload size={13} className="text-[#A39200] dark:text-[#FFE600]" />
              <h2 className="brut-title text-[#A39200] dark:text-[#FFE600]">List Content</h2>
            </div>
          </div>
          {showCreate
            ? <ChevronUp size={14} className="text-[var(--text-dim)]" />
            : <ChevronDown size={14} className="text-[var(--text-dim)]" />
          }
        </button>

        {showCreate && (
          <div className="space-y-3 pt-2 border-t-2 border-[var(--border-main)]">
            {!isVerified && (
              <div className="p-3 border-2 border-[#FF3B3B] bg-[#FF3B3B]/5">
                <p className="text-[10px] font-mono text-[#FF3B3B]">
                  ⚠ Stake at least {MIN_STAKE} ETH to list content
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Content ID</label>
              <input
                type="number" placeholder="e.g. 42" value={contentId}
                onChange={(e) => setContentId(e.target.value)}
                className="brut-input w-full" disabled={loadingCreate}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Price (ETH)</label>
              <input
                type="number" placeholder="e.g. 0.01" value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="brut-input w-full" disabled={loadingCreate}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Metadata URI (IPFS CID)</label>
              <input
                type="text" placeholder="ipfs://bafkrei..." value={metadataUri}
                onChange={(e) => setMetadataUri(e.target.value)}
                className="brut-input w-full font-mono text-xs" disabled={loadingCreate}
              />
            </div>
            <button
              onClick={handleCreateContent}
              disabled={!contentId || !price || !metadataUri || loadingCreate || !isVerified}
              className="brut-btn brut-btn-yellow w-full justify-center"
            >
              {loadingCreate ? <Loader2 size={12} className="animate-spin" /> : <PlusCircle size={12} />}
              List Content
            </button>
          </div>
        )}
      </div>

      {/* ── Release Payout ───────────────────────────────────────────────── */}
      <div className="brut-card space-y-4">
        <div className="flex items-center gap-3 border-b-2 border-[var(--border-main)] pb-3">
          <div className="w-2 h-6 bg-[#00FF87]" />
          <div className="flex items-center gap-1.5">
            <Wallet size={13} className="text-[#008A4B] dark:text-[#00FF87]" />
            <h2 className="brut-title text-[#008A4B] dark:text-[#00FF87]">Release Payout</h2>
            <InfoTooltip
              title="Claim Earnings"
              content="AFTER THE 24-HOUR DISPUTE WINDOW PASSES WITHOUT A CHALLENGE, CALL RELEASE PAYOUT TO MOVE YOUR EARNINGS INTO YOUR CLAIMABLE BALANCE, THEN WITHDRAW TO YOUR WALLET."
            />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Content ID</label>
            <input
              type="number" placeholder="42" value={payoutContentId}
              onChange={(e) => setPayoutContentId(e.target.value)}
              className="brut-input w-full" disabled={loadingPayout}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Payout #</label>
            <input
              type="number" placeholder="0" value={payoutIndex}
              onChange={(e) => setPayoutIndex(e.target.value)}
              className="brut-input w-full" disabled={loadingPayout}
            />
          </div>
        </div>

        <button
          onClick={handleReleasePayout}
          disabled={!payoutContentId || payoutIndex === "" || loadingPayout}
          className="brut-btn brut-btn-green w-full justify-center"
        >
          {loadingPayout ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />}
          Release Payout
        </button>

        {parseFloat(earnings) > 0 && (
          <p className="text-[10px] font-mono text-[#00FF87] text-center">
            ✓ {parseFloat(earnings).toFixed(4)} ETH ready to withdraw via Deposit panel
          </p>
        )}
      </div>
    </div>
  );
}
