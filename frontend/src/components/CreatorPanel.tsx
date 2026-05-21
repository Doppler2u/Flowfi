"use client";

import { useState, useEffect, useCallback } from "react";
import { parseUnits, formatUnits } from "viem";
import { useWeb3, ARC_TESTNET } from "@/context/Web3Provider";
import { FlowFiABI, CONTRACT_ADDRESS } from "@/lib/abi";
import { uploadMetadata } from "@/lib/ipfs";
import {
  Layers, ShieldCheck, PlusCircle, Wallet,
  Loader2, Unlock, ChevronDown, ChevronUp, Upload,
  LockKeyhole, FileText, Video, Image as ImageIcon, Code, Music
} from "lucide-react";
import InfoTooltip from "./InfoTooltip";

const MIN_STAKE = 5;
type ContentType = "Article" | "Video" | "Image" | "Code" | "Audio";

export default function CreatorPanel() {
  const {
    address, isConnected, walletClient, publicClient,
    addLog, refreshBalance, walletBalance
  } = useWeb3();

  // ── Stake State ───────────────────────────────────────────────────────────
  const [stakedBalance, setStakedBalance]   = useState("0");
  const [earnings, setEarnings]             = useState("0");
  const [stakeAmt, setStakeAmt]             = useState("");
  const [unstakeAmt, setUnstakeAmt]         = useState("");
  const [loadingStake, setLoadingStake]     = useState(false);
  const [loadingUnstake, setLoadingUnstake] = useState(false);

  // ── Create Content State ──────────────────────────────────────────────────
  const [showCreate, setShowCreate]         = useState(false);
  const [createId, setCreateId]             = useState("");
  const [createPrice, setCreatePrice]       = useState("");
  const [createTitle, setCreateTitle]       = useState("");
  const [createDesc, setCreateDesc]         = useState("");
  const [createSecret, setCreateSecret]     = useState("");
  const [createType, setCreateType]         = useState<ContentType>("Article");
  const [isIdTaken, setIsIdTaken]           = useState(false);
  const [checkingId, setCheckingId]         = useState(false);
  const [loadingCreate, setLoadingCreate]   = useState(false);

  // ── Payout State ──────────────────────────────────────────────────────────
  const [payoutContentId, setPayoutContentId] = useState("");
  const [payoutIndex, setPayoutIndex]         = useState("");
  const [loadingPayout, setLoadingPayout]     = useState(false);

  const isVerified = parseFloat(stakedBalance) >= MIN_STAKE;

  // ── Fetch on-chain data ───────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!publicClient || !address) return;
    try {
      const [staked, bal] = await Promise.all([
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: FlowFiABI, functionName: "stakedBalances", args: [address] }) as Promise<bigint>,
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: FlowFiABI, functionName: "balances", args: [address] }) as Promise<bigint>,
      ]);
      setStakedBalance(formatUnits(staked, 18));
      setEarnings(formatUnits(bal, 18));
    } catch {}
  }, [publicClient, address]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Debounced ID check ────────────────────────────────────────────────────
  useEffect(() => {
    if (!createId || !publicClient) { setIsIdTaken(false); return; }
    const t = setTimeout(async () => {
      setCheckingId(true);
      try {
        const res = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: FlowFiABI, functionName: "contents", args: [BigInt(createId)] }) as any;
        setIsIdTaken(res[2]);
      } catch { setIsIdTaken(false); } finally { setCheckingId(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [createId, publicClient]);

  // ── Stake ─────────────────────────────────────────────────────────────────
  const handleStake = async () => {
    if (!walletClient || !publicClient || !stakeAmt) return;
    setLoadingStake(true);
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS, abi: FlowFiABI, functionName: "stake",
        value: parseUnits(stakeAmt, 18), account: address as `0x${string}`,
        chain: ARC_TESTNET as any, gas: 150000n,
      });
      addLog({ type: "info", message: `Staked ${stakeAmt} USDC as creator collateral`, txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh(); setStakeAmt("");
    } catch (e: any) {
      addLog({ type: "error", message: `Stake failed: ${e.shortMessage || e.message}` });
    } finally { setLoadingStake(false); }
  };

  // ── Unstake ───────────────────────────────────────────────────────────────
  const handleUnstake = async () => {
    if (!walletClient || !publicClient || !unstakeAmt) return;
    setLoadingUnstake(true);
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS, abi: FlowFiABI, functionName: "unstake",
        args: [parseUnits(unstakeAmt, 18)], account: address as `0x${string}`,
        chain: ARC_TESTNET as any, gas: 150000n,
      });
      addLog({ type: "info", message: `Unstaked ${unstakeAmt} USDC`, txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh(); setUnstakeAmt("");
    } catch (e: any) {
      addLog({ type: "error", message: `Unstake failed: ${e.shortMessage || e.message}` });
    } finally { setLoadingUnstake(false); }
  };

  // ── Create Content ────────────────────────────────────────────────────────
  const handleCreateContent = async () => {
    if (!walletClient || !publicClient || !createId || !createPrice || !createTitle) return;
    if (!isVerified) {
      addLog({ type: "error", message: `Stake at least ${MIN_STAKE} USDC to list content.` });
      return;
    }
    setLoadingCreate(true);
    try {
      let encryptedData = undefined;
      if (createSecret) {
        addLog({ type: "info", message: "🔒 Encrypting content via Lit Protocol..." });
        const { encryptContent } = await import("@/lib/lit");
        encryptedData = await encryptContent(createSecret, createId);
      }
      addLog({ type: "info", message: "📦 Uploading metadata to IPFS..." });
      const cid = await uploadMetadata({ title: createTitle, description: createDesc, type: createType, version: "2.1.0", encryptedData });
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS, abi: FlowFiABI, functionName: "createContent",
        args: [BigInt(createId), parseUnits(createPrice, 18), cid],
        account: address as `0x${string}`, chain: ARC_TESTNET as any, gas: 300000n,
      });
      addLog({ type: "info", message: `Content #${createId} listed for ${createPrice} USDC`, txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      refreshBalance();
      setCreateId(""); setCreatePrice(""); setCreateTitle(""); setCreateDesc(""); setCreateSecret("");
      setShowCreate(false);
    } catch (e: any) {
      addLog({ type: "error", message: `Create failed: ${(e.message || "").slice(0, 200)}` });
    } finally { setLoadingCreate(false); }
  };

  const randomizeId = () => setCreateId((Math.floor(Math.random() * 1000000) + 100).toString());

  // ── Release Payout ────────────────────────────────────────────────────────
  const handleReleasePayout = async () => {
    if (!walletClient || !publicClient || !payoutContentId || payoutIndex === "") return;
    setLoadingPayout(true);
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS, abi: FlowFiABI, functionName: "releasePayout",
        args: [BigInt(payoutContentId), BigInt(payoutIndex)],
        account: address as `0x${string}`, chain: ARC_TESTNET as any, gas: 150000n,
      });
      addLog({ type: "info", message: `Payout released for Content #${payoutContentId}`, txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh(); setPayoutContentId(""); setPayoutIndex("");
    } catch (e: any) {
      addLog({ type: "error", message: `Release failed: ${e.shortMessage || e.message}` });
    } finally { setLoadingPayout(false); }
  };

  if (!isConnected) return null;

  return (
    <div className="brut-card flex flex-col h-full gap-5">

      {/* ── Creator Status ─────────────────────────────────────────────── */}
      <div className="shrink-0 space-y-4">
        <div className="flex items-center gap-3 border-b-2 border-[var(--border-main)] pb-3">
          <div className="w-2 h-6 bg-[#00D9FF]" />
          <div className="flex items-center gap-1.5 flex-1">
            <Layers size={13} className="text-[#00879F] dark:text-[#00D9FF] shrink-0" />
            <h2 className="brut-title text-[#00879F] dark:text-[#00D9FF]">Creator Panel</h2>
            <InfoTooltip
              title="Creator Verification"
              content="STAKE A MINIMUM OF 5 USDC AS COLLATERAL TO BECOME A VERIFIED CREATOR. THIS GIVES YOU SKIN IN THE GAME — FRAUDULENT CONTENT CAN RESULT IN STAKE SLASHING VIA AI ARBITRATION."
            />
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 border-2 text-[9px] font-black uppercase shrink-0 ${
            isVerified ? "border-[#00FF87] text-[#00FF87] bg-[#00FF87]/10" : "border-[var(--border-main)] text-[var(--text-dim)]"
          }`}>
            <ShieldCheck size={10} />
            {isVerified ? "Verified" : "Unverified"}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 border-2 border-[var(--border-main)] bg-[var(--bg-page)]/50 space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-dim)]">Staked</p>
            <p className="text-xl font-black text-[#00D9FF] font-mono tabular-nums">{parseFloat(stakedBalance).toFixed(3)}</p>
            <p className="text-[9px] font-mono text-[#00879F]">USDC collateral</p>
          </div>
          <div className="p-3 border-2 border-[var(--border-main)] bg-[var(--bg-page)]/50 space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-dim)]">Refunds / Earnings</p>
            <p className="text-xl font-black text-[#00FF87] font-mono tabular-nums">{parseFloat(earnings).toFixed(3)}</p>
            <p className="text-[9px] font-mono text-[#008A4B]">USDC claimable</p>
          </div>
        </div>

        {/* Stake / Unstake */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Stake USDC</label>
            <div className="flex gap-0">
              <input type="number" placeholder={`${MIN_STAKE}.0`} value={stakeAmt} onChange={(e) => setStakeAmt(e.target.value)}
                className="brut-input flex-1 text-sm" style={{ borderRight: "none" }} disabled={loadingStake} />
              <button onClick={handleStake} disabled={!stakeAmt || loadingStake} className="brut-btn brut-btn-cyan shrink-0 px-3">
                {loadingStake ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
              </button>
            </div>
            <p className="text-[9px] font-mono text-[var(--text-dim)]">
              Wallet: {parseFloat(walletBalance || "0").toFixed(3)} USDC · Min: {MIN_STAKE}
            </p>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Unstake USDC</label>
            <div className="flex gap-0">
              <input type="number" placeholder="0.0" value={unstakeAmt} onChange={(e) => setUnstakeAmt(e.target.value)}
                className="brut-input flex-1 text-sm" style={{ borderRight: "none" }} disabled={loadingUnstake} />
              <button onClick={handleUnstake} disabled={!unstakeAmt || loadingUnstake} className="brut-btn brut-btn-red shrink-0 px-3">
                {loadingUnstake ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />}
              </button>
            </div>
            <p className="text-[9px] font-mono text-[var(--text-dim)]">Staked: {parseFloat(stakedBalance).toFixed(3)} USDC</p>
          </div>
        </div>
      </div>

      {/* ── List Content ────────────────────────────────────────────────── */}
      <div className="shrink-0 border-2 border-[var(--border-main)] bg-[var(--bg-page)]/30 p-4 space-y-3">
        <button onClick={() => setShowCreate(!showCreate)} className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-5 bg-[#FFE600]" />
            <Upload size={13} className="text-[#A39200] dark:text-[#FFE600]" />
            <h2 className="brut-title text-[#A39200] dark:text-[#FFE600]">List Content</h2>
          </div>
          {showCreate ? <ChevronUp size={14} className="text-[var(--text-dim)]" /> : <ChevronDown size={14} className="text-[var(--text-dim)]" />}
        </button>

        {showCreate && (
          <div className="space-y-3 pt-2 border-t border-[var(--border-main)]">
            {!isVerified && (
              <div className="p-2 border-2 border-[#FF3B3B] bg-[#FF3B3B]/5">
                <p className="text-[10px] font-mono text-[#FF3B3B]">⚠ Stake at least {MIN_STAKE} USDC to list content</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Content ID</label>
                <div className="flex gap-0">
                  <input type="number" placeholder="42" value={createId} onChange={(e) => setCreateId(e.target.value)}
                    className={`brut-input flex-1 text-sm ${isIdTaken ? "error" : ""}`} style={{ borderRight: "none" }} disabled={loadingCreate} />
                  <button onClick={randomizeId} className="px-2 border-2 border-[var(--border-main)] text-[8px] font-black text-[#FFE600] bg-black">
                    RND
                  </button>
                </div>
                {isIdTaken && <p className="text-[9px] font-mono text-[#FF3B3B]">// ID taken</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Price (USDC)</label>
                <input type="number" placeholder="0.01" value={createPrice} onChange={(e) => setCreatePrice(e.target.value)}
                  className="brut-input w-full text-sm" disabled={loadingCreate} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Title</label>
              <input type="text" placeholder="Content title" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)}
                className="brut-input w-full text-sm" disabled={loadingCreate} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Category</label>
                <select value={createType} onChange={(e) => setCreateType(e.target.value as ContentType)}
                  className="brut-input w-full text-sm bg-[var(--bg-page)]" disabled={loadingCreate}>
                  <option value="Article">Article</option>
                  <option value="Video">Video</option>
                  <option value="Image">Image</option>
                  <option value="Code">Code</option>
                  <option value="Audio">Audio</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Description</label>
                <input type="text" placeholder="Short description" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)}
                  className="brut-input w-full text-sm" disabled={loadingCreate} />
              </div>
            </div>
            <div className="space-y-1.5 p-3 border-2 border-dashed border-[#FFE600]/30 bg-[#FFE600]/5">
              <label className="text-[10px] font-black text-[#FFE600] uppercase flex items-center gap-1.5">
                <LockKeyhole size={11} /> Secret (Lit Encrypted)
              </label>
              <input type="text" placeholder="Private URL, key, or secret..." value={createSecret} onChange={(e) => setCreateSecret(e.target.value)}
                className="brut-input w-full text-sm" disabled={loadingCreate} />
            </div>
            <button onClick={handleCreateContent}
              disabled={!createId || !createPrice || !createTitle || !createSecret || loadingCreate || isIdTaken || checkingId || !isVerified}
              className="brut-btn brut-btn-yellow w-full justify-center">
              {loadingCreate ? <Loader2 size={12} className="animate-spin" /> : <PlusCircle size={12} />}
              List Content
            </button>
          </div>
        )}
      </div>

      {/* ── Release Payout ───────────────────────────────────────────────── */}
      <div className="flex-1 border-2 border-[var(--border-main)] bg-[var(--bg-page)]/30 p-4 space-y-4">
        <div className="flex items-center gap-2 border-b-2 border-[var(--border-main)] pb-3">
          <div className="w-2 h-5 bg-[#00FF87]" />
          <Wallet size={13} className="text-[#008A4B] dark:text-[#00FF87]" />
          <h2 className="brut-title text-[#008A4B] dark:text-[#00FF87]">Release Payout</h2>
          <InfoTooltip
            title="Claim Earnings"
            content="AFTER THE 24-HOUR DISPUTE WINDOW PASSES WITHOUT A CHALLENGE, CALL RELEASE PAYOUT TO MOVE EARNINGS INTO YOUR CLAIMABLE BALANCE, THEN WITHDRAW FROM THE DEPOSIT PANEL."
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Content ID</label>
            <input type="number" placeholder="42" value={payoutContentId} onChange={(e) => setPayoutContentId(e.target.value)}
              className="brut-input w-full" disabled={loadingPayout} />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black uppercase text-[var(--text-dim)]">Payout #</label>
            <input type="number" placeholder="0" value={payoutIndex} onChange={(e) => setPayoutIndex(e.target.value)}
              className="brut-input w-full" disabled={loadingPayout} />
          </div>
        </div>
        <button onClick={handleReleasePayout}
          disabled={!payoutContentId || payoutIndex === "" || loadingPayout}
          className="brut-btn brut-btn-green w-full justify-center">
          {loadingPayout ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />}
          Release Payout
        </button>
        {parseFloat(earnings) > 0 && (
          <p className="text-[10px] font-mono text-[#00FF87] text-center">
            ✓ {parseFloat(earnings).toFixed(4)} USDC ready → withdraw via Deposit panel
          </p>
        )}
      </div>
    </div>
  );
}
