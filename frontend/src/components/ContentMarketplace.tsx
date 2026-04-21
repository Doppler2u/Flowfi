"use client";

import { useState, useEffect, useCallback } from "react";
import { useWeb3, ARC_TESTNET } from "@/context/Web3Provider";
import { FlowFiABI, CONTRACT_ADDRESS } from "../lib/abi";
import { parseUnits, formatUnits, decodeEventLog } from "viem";
import { uploadMetadata, fetchMetadata, ContentMetadata } from "@/lib/ipfs";
import { 
  PlusCircle, 
  RefreshCw, 
  LockKeyhole, 
  FileText, 
  Video, 
  Image as ImageIcon, 
  Code,
  Music,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Info,
  X,
  ShieldAlert,
  Coins,
  History,
  Timer
} from "lucide-react";
import InfoTooltip from "./InfoTooltip";

type ContentType = "Article" | "Video" | "Image" | "Code" | "Audio";

let DEPLOYMENT_BLOCK = 5180000n; // Set a safe starting block for Arc Testnet
const CHUNK_SIZE = 5000n;

interface GalleryItem {
  id: bigint;
  creator: string;
  price: bigint;
  title: string;
  description: string;
  type: ContentType;
  metadataURI: string;
  hasAccess: boolean;
  payouts: PayoutData[];
}

interface PayoutData {
  creator: string;
  amount: bigint;
  releaseTime: bigint;
  isDisputed: boolean;
  resolved: boolean;
}

const TYPE_ICONS = {
  Article: FileText,
  Video: Video,
  Image: ImageIcon,
  Code: Code,
  Audio: Music
};

const COLORS = {
  Article: "text-blue-400 border-blue-400",
  Video: "text-rose-400 border-rose-400",
  Image: "text-amber-400 border-amber-400",
  Code: "text-emerald-400 border-emerald-400",
  Audio: "text-violet-400 border-violet-400"
};

export default function ContentMarketplace() {
  const { address, isConnected, walletClient, publicClient, addLog, refreshBalance, contractBalance } = useWeb3();

  const [activeTab, setActiveTab] = useState<"gallery" | "my-content" | "create" | "staking">("gallery");

  // Create State
  const [createId, setCreateId] = useState("");
  const [createPrice, setCreatePrice] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createSecret, setCreateSecret] = useState("");
  const [createType, setCreateType] = useState<ContentType>("Article");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [revealingId, setRevealingId] = useState<bigint | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  
  const [isIdTaken, setIsIdTaken] = useState(false);
  const [checkingId, setCheckingId] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  // Staking State
  const [stakedBalance, setStakedBalance] = useState("0");
  const [isStaked, setIsStaked] = useState(false);
  const [loadingStake, setLoadingStake] = useState(false);
  const [loadingUnstake, setLoadingUnstake] = useState(false);
  const [stakingHistory, setStakingHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Gallery State
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [unlockingId, setUnlockingId] = useState<bigint | null>(null);
  const [disputingId, setDisputingId] = useState<bigint | null>(null);

  // Debounced ID availability check
  useEffect(() => {
    if (!createId || !publicClient) {
      setIsIdTaken(false);
      return;
    }
    const timeout = setTimeout(async () => {
      setCheckingId(true);
      try {
        const id = BigInt(createId);
        const res = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: FlowFiABI,
          functionName: "contents",
          args: [id],
        }) as [string, bigint, boolean];
        setIsIdTaken(res[2]);
      } catch (e) {
        setIsIdTaken(false);
      } finally {
        setCheckingId(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [createId, publicClient]);

  // Load Staking Info
  useEffect(() => {
    if (address && publicClient) {
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "stakedBalances",
        args: [address],
      }).then((res) => {
        const val = res as bigint;
        setStakedBalance(formatUnits(val, 18));
        setIsStaked(val >= parseUnits("5", 18));
      });
      fetchStakingHistory();
    }
  }, [address, publicClient, activeTab]);

  // Pre-connect to Lit Protocol on mount to ensure readiness for encryption
  useEffect(() => {
    const initLit = async () => {
      try {
        const { getLitClient } = await import("@/lib/lit");
        await getLitClient();
        console.log("Lit Protocol initialized and ready.");
      } catch (e) {
        console.warn("Lit initialization deferred:", e);
      }
    };
    initLit();
  }, []);

  const fetchStakingHistory = async () => {
    if (!address || !publicClient) return;
    setLoadingHistory(true);
    try {
      const currentBlock = await publicClient.getBlockNumber();
      // Stay safely within the 10,000 limit of the Arc RPC
      const safeFrom = currentBlock > 9500n ? currentBlock - 9500n : 0n;
      
      const logs = await publicClient.getLogs({
        address: CONTRACT_ADDRESS,
        event: FlowFiABI.find(x => x.name === "Staked"), 
        args: { user: address },
        fromBlock: safeFrom,
      });

      const unstakeLogs = await publicClient.getLogs({
        address: CONTRACT_ADDRESS,
        event: FlowFiABI.find(x => x.name === "Unstaked"),
        args: { user: address },
        fromBlock: safeFrom,
      });

      const history = [
        ...logs.map(l => ({ type: "STAKE", amount: (l as any).args.amount, hash: l.transactionHash, block: l.blockNumber || 0n })),
        ...unstakeLogs.map(l => ({ type: "UNSTAKE", amount: (l as any).args.amount, hash: l.transactionHash, block: l.blockNumber || 0n }))
      ].sort((a, b) => Number(b.block - a.block));
      
      setStakingHistory(history);
    } catch (e) {
      console.error("History fetch error", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load Gallery
  useEffect(() => {
    if (activeTab === "gallery" || activeTab === "my-content" || activeTab === "staking") {
      fetchGallery();
    }
  }, [activeTab, publicClient, address, isConnected]);
  
  const [isDeepScanning, setIsDeepScanning] = useState(false);

  const fetchGallery = useCallback(async (targetBlocks?: bigint) => {
    if (!publicClient) return;
    setLoadingGallery(true);
    try {
      const currentBlock = await publicClient.getBlockNumber();
      // Apply a 10-block buffer to avoid hitting out-of-sync RPC nodes (Race Condition Shield)
      const safeTip = currentBlock > 10n ? currentBlock - 10n : currentBlock;
      
      const lookbackLimit = targetBlocks || (15000n);
      const stopBlock = safeTip > lookbackLimit ? safeTip - lookbackLimit : DEPLOYMENT_BLOCK;
      const finalStopBlock = stopBlock < DEPLOYMENT_BLOCK ? DEPLOYMENT_BLOCK : stopBlock;

      let currentTo = safeTip;
      const uniqueEvents = new Map();
      
      addLog({ type: "info", message: `Protocol Scan: Syncing history to block ${finalStopBlock}...` });

      // Using a much smaller chunk size (1000) for maximum reliability across different RPC providers
      const SAFE_CHUNK = 1000n;

      while (currentTo > finalStopBlock) {
        const currentFrom = currentTo > SAFE_CHUNK ? currentTo - SAFE_CHUNK : finalStopBlock;
        const scanFrom = currentFrom < finalStopBlock ? finalStopBlock : currentFrom;

        if (scanFrom >= currentTo) break;

        // Manual hex-encoding for optimal RPC compatibility
        const fromHex = `0x${scanFrom.toString(16)}`;
        const toHex = `0x${currentTo.toString(16)}`;

        const logs = await publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          fromBlock: fromHex as any,
          toBlock: toHex as any,
        });

        for (const log of logs) {
          try {
            const decoded = decodeEventLog({
              abi: FlowFiABI,
              data: log.data,
              topics: log.topics,
            });
            
            if (decoded.eventName === "ContentCreated") {
              const args = decoded.args as any;
              const id = args.contentId;
              if (id !== undefined) {
                uniqueEvents.set(id.toString(), {
                  id,
                  creator: args.creator,
                  price: args.price,
                  metadataURI: args.metadataURI
                });
              }
            }
          } catch (e) {}
        }
        
        currentTo = scanFrom;
      }

      const items: GalleryItem[] = [];
      for (const eventData of uniqueEvents.values()) {
        const id = eventData.id as bigint;
        const creator = eventData.creator as string;
        const price = eventData.price as bigint;
        const metadataURI = eventData.metadataURI as string;

        let hasAccess = false;
        if (address) {
          try {
            const balance = await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: FlowFiABI,
              functionName: "balanceOf",
              args: [address, id],
            }) as bigint;
            hasAccess = balance > 0n;
          } catch (e) {}
        }

        let title = `Content #${id.toString()}`;
        let description = "Protocol registered asset";
        let type: ContentType = "Article";
        
        try {
          if (metadataURI.startsWith("ipfs://")) {
            const cid = metadataURI.replace("ipfs://", "");
            const meta = await fetchMetadata(cid);
            title = meta.title;
            description = meta.description;
            type = meta.type as ContentType;
          }
        } catch (e) {
          console.warn(`Meta fetch failed for ${id}`, e);
        }

        // Fetch payouts/escrow info for the management tab or detail view
        let payouts: PayoutData[] = [];
        try {
          // In a real indexer this would be one call, here we just check if it exists
          const p = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: FlowFiABI,
            functionName: "contentPayouts",
            args: [id, 0n],
          }) as [string, bigint, bigint, bool, bool];
          payouts.push({ creator: p[0], amount: p[1], releaseTime: p[2], isDisputed: p[3], resolved: p[4] });
        } catch (e) {}

        items.push({ id, creator, price, title, description, type, metadataURI, hasAccess, payouts });
      }

      setGalleryItems(items.reverse());
      addLog({ type: "info", message: `Scan Complete: ${items.length} assets recovered.` });
    } catch (e: any) {
      console.error("Gallery fetch error:", e);
      addLog({ type: "error", message: `Scanner Error: ${e.message?.slice(0, 100)}...` });
    } finally {
      setLoadingGallery(false);
    }
  }, [publicClient, addLog, address]);

  const deepScan = async () => {
    if (!publicClient || isDeepScanning) return;
    setIsDeepScanning(true);
    addLog({ type: "info", message: "Starting Deep Rescue Scan (100,000 blocks)..." });
    try {
    // Full history scan (approx 150k blocks)
    await fetchGallery(200000n);
      addLog({ type: "info", message: "Deep Scan Complete." });
    } catch (e) {
      addLog({ type: "error", message: "Deep Scan failed. Network busy." });
    } finally {
      setIsDeepScanning(false);
    }
  };

  const randomizeId = () => {
    // Generate a high-entropy random number to prevent collisions
    const rand = Math.floor(Math.random() * 1000000) + 100;
    setCreateId(rand.toString());
  };

  const handleCreateContent = async () => {
    if (!walletClient || !publicClient || !createId || !createPrice || !createTitle) return;
    if (!isStaked) {
      addLog({ type: "error", message: "Staking Required: You must stake 5 USDC to create content." });
      setActiveTab("staking");
      return;
    }

    setLoadingCreate(true);
    try {
      // 1. Encrypt secret content via Lit (if provided)
      let encryptedData = undefined;
      if (createSecret) {
        addLog({ type: "info", message: "🔒 Encrypting content via Lit Protocol..." });
        const { encryptContent } = await import("@/lib/lit");
        encryptedData = await encryptContent(createSecret, createId);
      }

      // 2. Upload metadata to IPFS
      addLog({ type: "info", message: "📦 Preparing decentralized metadata..." });
      const cid = await uploadMetadata({
        title: createTitle,
        description: createDesc,
        type: createType,
        version: "2.1.0",
        encryptedData
      });
      
      const priceWei = parseUnits(createPrice, 18);
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "createContent",
        args: [BigInt(createId), priceWei, cid],
        account: address as `0x${string}`,
        chain: ARC_TESTNET as any,
        gas: 300000n,
      });

      addLog({ type: "info", message: `Success! Transaction Hash: ${hash}`, txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      
      addLog({ type: "info", message: `Content #${createId} is now live with immutable IPFS metadata.`, txHash: hash });
      setCreateId("");
      setCreatePrice("");
      setCreateTitle("");
      setCreateDesc("");
      setCreateSecret("");
      fetchGallery();
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Failed to create content";
      addLog({ type: "error", message: msg.slice(0, 200) });
    } finally {
      setLoadingCreate(false);
      refreshBalance();
    }
  };

  const handleReveal = async (item: GalleryItem) => {
    if (!address) return;
    setRevealingId(item.id);
    try {
      // 1. Fetch metadata to get encrypted data
      const metadata = await fetchMetadata(item.metadataURI);
      if (!metadata.encryptedData) {
        addLog({ type: "info", message: "Legacy content: No encrypted secret found." });
        setRevealedSecrets(prev => ({ ...prev, [item.id.toString()]: "NO ENCRYPTED SECRET IN METADATA" }));
        return;
      }

      // 2. Decrypt via Lit
      addLog({ type: "info", message: "🔓 Requesting decryption from Lit network..." });
      const { decryptContent } = await import("@/lib/lit");
      const secret = await decryptContent(
        metadata.encryptedData.ciphertext,
        metadata.encryptedData.dataToEncryptHash,
        item.id.toString()
      );

      setRevealedSecrets(prev => ({ ...prev, [item.id.toString()]: secret }));
      addLog({ type: "info", message: "Decryption Successful! Secret revealed." });
    } catch (e: any) {
      console.error(e);
      addLog({ type: "error", message: `Access Denied: ${e.message || "Verify NFT ownership"}` });
    } finally {
      setRevealingId(null);
    }
  };

  const handleStake = async () => {
    if (!walletClient || !publicClient) return;
    setLoadingStake(true);
    try {
      addLog({ type: "info", message: "Compiling 5 USDC Stake for Creator eligibility..." });
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "stake",
        account: address,
        value: parseUnits("5", 18),
        chain: ARC_TESTNET as any,
        gas: 150000n,
      });
      addLog({ type: "info", message: "Stake transaction submitted...", txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      addLog({ type: "info", message: "Stake successful! You are now a verified Creator.", txHash: hash });
      refreshBalance();
      fetchStakingHistory();
    } catch (e: any) {
      addLog({ type: "error", message: "Staking failed. Check balance." });
    } finally {
      setLoadingStake(false);
    }
  };

  const handleUnstake = async () => {
    if (!walletClient || !publicClient) return;
    setLoadingUnstake(true);
    try {
      addLog({ type: "info", message: "Requesting collateral withdrawal (5 USDC)..." });
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "unstake",
        args: [parseUnits("5", 18)],
        account: address as `0x${string}`,
        chain: ARC_TESTNET as any,
        gas: 150000n,
      });
      addLog({ type: "info", message: "Unstake transaction submitted...", txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      addLog({ type: "info", message: "Successfully unstaked 5 USDC.", txHash: hash });
      refreshBalance();
      fetchStakingHistory();
    } catch (e: any) {
      addLog({ type: "error", message: "Unstaking failed. Active assets or disputes may prevent withdrawal." });
    } finally {
      setLoadingUnstake(false);
    }
  };

  const handleDispute = async (id: bigint, payoutIndex: number) => {
    if (!walletClient || !publicClient) return;
    setDisputingId(id);
    try {
      addLog({ type: "info", message: "Raising Dispute. Requires 2 USDC security deposit..." });
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "dispute",
        args: [id, BigInt(payoutIndex)],
        account: address,
        value: parseUnits("2", 18),
        chain: ARC_TESTNET as any,
        gas: 200000n,
      });
      addLog({ type: "info", message: "Dispute transaction submitted...", txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });
      addLog({ type: "info", message: "Dispute Raised. Funds frozen in escrow.", txHash: hash });
      fetchGallery();
    } catch (e: any) {
      addLog({ type: "error", message: "Dispute failed. Ensure you have 2 USDC." });
    } finally {
      setDisputingId(null);
    }
  };

  const handleUnlock = async (id: bigint, price: bigint) => {
    if (!walletClient || !publicClient) return;
    setUnlockingId(id);
    try {
      addLog({ type: "info", message: `Confirm unlock for content #${id.toString()} in MetaMask...` });

      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "unlockContent",
        args: [id],
        account: address,
        chain: ARC_TESTNET as any, // satisfies viem strict typing
        gas: 250000n, // Bypassing brittle Arc RPC simulation with manual gas
      });

      addLog({ type: "info", message: `Unlocking... Hash: ${hash}` });

      await publicClient.waitForTransactionReceipt({ hash });
      addLog({ type: "info", message: `Successfully unlocked content #${id.toString()}! View it in My Library.` });
      
      refreshBalance();
      fetchGallery();
    } catch (err) {
      const error = err as any;
      const msg = error.message || "Failed to unlock content";
      addLog({ type: "error", message: msg.length > 200 ? msg.slice(0, 200) + "..." : msg });
    } finally {
      setUnlockingId(null);
    }
  };

  const isDisabled = !isConnected;

  return (
    <div className="brut-card flex flex-col h-full">
      {/* Experimental Features Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-none" onClick={() => setShowWarning(false)} />
          <div className="relative z-10 max-w-lg w-full bg-[var(--bg-card)] border-4 border-[#FFE600] p-6 shadow-none flex flex-col">
            <div className="flex justify-between items-start mb-6 text-[var(--text-main)]">
              <div className="flex items-center gap-3">
                <AlertTriangle size={24} className="text-[#FFE600]" />
                <h2 className="text-xl font-black uppercase tracking-tighter">FlowFi Architecture Update</h2>
              </div>
              <button onClick={() => setShowWarning(false)} className="text-[var(--text-dim)] hover:text-[#FFE600]">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2 scrollbar-thin font-mono text-[10px]">
              
              <div className="space-y-3">
                <p className="font-bold text-[#00FF87] uppercase tracking-widest text-xs border-b-2 border-[#00FF87]/30 pb-1">Phase 1 & 2: Implemented</p>
                <div className="border border-[#333] p-3 space-y-2">
                  <p><span className="text-white font-bold">1. Escrow & Disputes:</span> Payments are locked in the smart contract. Buyers must deposit 2 USDC to raise a dispute, freezing funds and preventing 'friendly fraud'.</p>
                  <p><span className="text-white font-bold">2. Lit Protocol Privacy:</span> Secret content is encrypted locally. It is only decrypted by decentralized nodes if the user holds the valid Access NFT on the Arc Testnet.</p>
                  <p><span className="text-white font-bold">3. Creator Staking:</span> Creators must lock 5 USDC into the platform to list assets, providing an economic deterrent against spam.</p>
                </div>
              </div>

              <div className="space-y-3 mt-6">
                <p className="font-bold text-[#FFE600] uppercase tracking-widest text-xs border-b-2 border-[#FFE600]/30 pb-1">Phase 3: Coming Soon</p>
                
                <div className="border border-[#333] p-3 space-y-2">
                   <p><span className="text-[#00D9FF] font-bold">1. Decentralized Juries:</span> The current central Administrator role for resolving disputes will transition to a decentralized voting community (e.g. Kleros).</p>
                   <p><span className="text-[#FF3B3B] font-bold">2. GenLayer AI Validation:</span> Autonomous AI agents will pre-validate URLs and content off-chain before executing the final Escrow release.</p>
                </div>
              </div>

            </div>
            
            <button
              onClick={() => setShowWarning(false)}
              className="mt-8 brut-btn brut-btn-yellow w-full"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="shrink-0 space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-[var(--text-main)] uppercase leading-tight font-sans">
              CONTENT<br/>MARKETPLACE
            </h2>
            <InfoTooltip 
              title="Decentralized Storefront"
              content="A DIGITAL ASSET HUB WHERE CREATORS SELL ACCESS TO 'SECRETS' (LINKS, KEYS, CODE). PAYMENTS ESCROW AUTOMATICALLY ON-CHAIN, REVEALING CONTENT ONLY TO AUTHORIZED BUYERS."
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <button
              onClick={() => setShowWarning(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#FFE600] text-black text-[10px] font-black uppercase border-2 border-[#FFE600] hover:bg-black hover:text-[#FFE600] transition-all whitespace-nowrap"
            >
              <AlertTriangle size={12} />
              Architecture Overview
            </button>
            <div className="hidden sm:block border-l-2 border-[var(--border-main)] pl-4 text-[9px] font-mono leading-tight">
              <p><span className="text-[#00FF87] font-bold">LIVE:</span> Escrow | Staking | Lit Encryption</p>
              <p><span className="text-[#FFE600] font-bold mt-1 inline-block">COMING SOON:</span> AI Validation | Decentralized Juries</p>
            </div>
          </div>
        </div>
        
        <div className="flex border-2 border-[var(--border-main)] w-full overflow-x-auto scrollbar-none shrink-0">
          <button
            onClick={() => setActiveTab("gallery")}
            className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "gallery" ? "bg-[#FFE600] text-black" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"}`}
          >
            Gallery
          </button>
          <button
            onClick={() => setActiveTab("my-content")}
            className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest border-x-2 border-[var(--border-main)] transition-all whitespace-nowrap ${activeTab === "my-content" ? "bg-[#FFE600] text-black" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"}`}
          >
            Library
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest border-r-2 border-[var(--border-main)] transition-all whitespace-nowrap ${activeTab === "create" ? "bg-[#FFE600] text-black" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"}`}
          >
            Register
          </button>
          <button
            onClick={() => setActiveTab("staking")}
            className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "staking" ? "bg-[#FFE600] text-black" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"}`}
          >
            Staking
          </button>
        </div>
        <div className="border-b-2 border-[var(--border-main)] w-full" />
      </div>

      <div className="flex-1 overflow-hidden mt-6">
        {activeTab === "create" ? (
          !isStaked ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 p-8 border-4 border-dashed border-[#222]">
              <ShieldAlert size={48} className="text-[#FFE600] animate-pulse" />
              <div className="space-y-2">
                <h3 className="text-lg font-black uppercase tracking-tighter">Creator Staking Required</h3>
                <p className="text-[10px] font-mono text-[#888] max-w-[240px] leading-relaxed">
                  YOU MUST HAVE AT LEAST 5 USDC STAKED IN THE PROTOCOL TO REGISTER NEW ASSETS. THIS PROTECTS THE MARKETPLACE FROM SCAMS.
                </p>
              </div>
              <button 
                onClick={() => setActiveTab("staking")}
                className="brut-btn brut-btn-yellow px-8"
              >
                Go to Staking
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col space-y-6 overflow-y-auto pr-2 scrollbar-thin">
              <p className="text-[11px] font-mono text-[#555]">// Register new pay-to-access asset on-chain</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#888] uppercase tracking-widest">Content ID</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="E.G. 42"
                      value={createId}
                      onChange={(e) => setCreateId(e.target.value)}
                      disabled={isDisabled}
                      className={`brut-input flex-1 ${isIdTaken ? "error" : ""}`}
                    />
                    <button 
                      onClick={randomizeId}
                      type="button"
                      className="px-2 py-2 bg-black text-[#FFE600] border-2 border-[var(--border-main)] hover:border-[#FFE600] text-[8px] font-black uppercase transition-all"
                      title="Generate Random ID"
                    >
                      Random
                    </button>
                  </div>
                  {isIdTaken && <p className="text-[9px] font-mono text-[#FF3B3B]">// ID already exists in system</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#888] uppercase tracking-widest">Price (USDC)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={createPrice}
                    onChange={(e) => setCreatePrice(e.target.value)}
                    disabled={isDisabled}
                    className="brut-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#888] uppercase tracking-widest">Title</label>
                <input
                  type="text"
                  placeholder="CONTENT TITLE"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  disabled={isDisabled}
                  className="brut-input"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#888] uppercase tracking-widest">Category</label>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value as ContentType)}
                  disabled={isDisabled}
                  className="brut-input bg-[#111]"
                >
                  <option value="Article">ARTICLE / TEXT</option>
                  <option value="Video">VIDEO STREAM</option>
                  <option value="Image">DIGITAL IMAGE</option>
                  <option value="Code">SOURCE CODE</option>
                  <option value="Audio">AUDIO ASSET</option>
                </select>
              </div>

              <div className="space-y-2 pb-4">
                <label className="text-[10px] font-black text-[#888] uppercase tracking-widest">Description</label>
                <textarea
                  placeholder="DESCRIBE THE CONTENT FOR POTENTIAL BUYERS..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  disabled={isDisabled}
                  rows={2}
                  className="brut-input resize-none"
                />
              </div>

              <div className="space-y-2 pb-4 p-4 border-2 border-dashed border-[#FFE600]/30 bg-[#FFE600]/5">
                <label className="text-[10px] font-black text-[#FFE600] uppercase tracking-widest flex items-center gap-2">
                  <LockKeyhole size={12} /> Secret Content (Encrypted)
                </label>
                <p className="text-[8px] font-mono text-[#888] mb-2 uppercase tracking-tighter">
                  THIS CONTENT WILL BE ENCRYPTED BY LIT PROTOCOL. ONLY NFT HOLDERS CAN DECRYPT AND VIEW IT.
                </p>
                <textarea
                  placeholder="PRIVATE URL, KEY, OR SECRET MESSAGE..."
                  value={createSecret}
                  onChange={(e) => setCreateSecret(e.target.value)}
                  disabled={isDisabled}
                  rows={2}
                  className="brut-input resize-none border-[#FFE600]/30 focus:border-[#FFE600]"
                />
              </div>
              
              <button
                onClick={handleCreateContent}
                disabled={isDisabled || !createId || !createPrice || !createTitle || !createDesc || !createSecret || loadingCreate || isIdTaken || checkingId}
                className="brut-btn brut-btn-yellow w-full sticky bottom-0"
              >
                {loadingCreate ? <Loader2 size={14} className="animate-spin text-black" /> : <PlusCircle size={14} className="text-black" />}
                Confirm Registration
              </button>
            </div>
          )
        ) : activeTab === "staking" ? (
          <div className="h-full flex flex-col space-y-6 overflow-y-auto pr-2 scrollbar-thin">
            <div className="border-4 border-[var(--border-main)] p-6 bg-black flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 bg-[#FFE600] text-black rounded-full">
                <ShieldAlert size={32} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tighter">Creator Staking</h2>
              <p className="text-[10px] font-mono text-[#888] leading-relaxed max-w-[280px]">
                TO PREVENT SCAMS AND LOW-QUALITY SPAM, ALL CREATORS MUST STAKE A MINIMUM OF 5 USDC. THIS COLLATERAL IS SLASHABLE IN CASE OF VERIFIED FRAUD.
              </p>
              
              <div className="flex flex-col gap-2 w-full mt-4">
                <div className="flex justify-between items-center px-4 py-3 border-2 border-[var(--border-main)]">
                  <span className="text-[10px] font-black uppercase">Current Stake</span>
                  <span className="text-xs font-mono font-bold text-[#FFE600]">{stakedBalance} USDC</span>
                </div>
                
                {!isStaked ? (
                  <button 
                    onClick={handleStake}
                    disabled={loadingStake}
                    className="brut-btn brut-btn-yellow w-full"
                  >
                    {loadingStake ? <Loader2 size={14} className="animate-spin mr-2" /> : <Coins size={14} className="mr-2" />}
                    Stake 5 USDC to Unlock
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="p-3 border-2 border-[#00FF87] bg-[#00FF87]/5 text-[#00FF87] text-[10px] font-black uppercase flex items-center justify-center gap-2">
                      <CheckCircle2 size={14} /> Creator Status Verified
                    </div>
                    <button 
                      onClick={handleUnstake}
                      disabled={loadingUnstake}
                      className="brut-btn border-[#555] text-[#888] bg-transparent hover:border-white hover:text-white w-full h-8"
                    >
                      {loadingUnstake ? <Loader2 size={12} className="animate-spin mr-2 inline-block" /> : null}
                      Unstake Collateral
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase text-[#555] tracking-widest flex items-center gap-2">
                <History size={12} /> Staking History
              </h3>
              
              <div className="space-y-2">
                {loadingHistory ? (
                  <div className="p-4 border-2 border-dashed border-[#222] flex justify-center">
                    <Loader2 size={16} className="animate-spin text-[#333]" />
                  </div>
                ) : stakingHistory.length === 0 ? (
                  <div className="border-2 border-dashed border-[#222] p-8 flex flex-col items-center justify-center text-[#333]">
                    <p className="text-[10px] font-mono uppercase">No staking history found</p>
                  </div>
                ) : (
                  stakingHistory.map((h, i) => (
                    <div key={i} className="border-2 border-[var(--border-main)] p-3 bg-[var(--bg-card)] flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-6 ${h.type === 'STAKE' ? 'bg-[#00FF87]' : 'bg-[#FF3B3B]'}`} />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-tight">{h.type} COLLATERAL</p>
                          <p className="text-[9px] font-mono text-[#555] uppercase mt-0.5">{formatUnits(h.amount, 18)} USDC</p>
                        </div>
                      </div>
                      <a 
                        href={`https://testnet.arcscan.app/tx/${h.txHash || h.hash}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-1.5 border-2 border-transparent group-hover:border-[#FFE600] group-hover:text-[#FFE600] transition-all"
                      >
                        <History size={12} />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col space-y-4">
            <div className={`flex justify-between items-center text-[10px] font-mono ${loadingGallery ? "text-[#FFE600]" : "text-[#555]"}`}>
              <p>{loadingGallery ? "Decrypting logs..." : "Search range: Last 9.5K blocks"}</p>
              <div className="flex items-center gap-4">
                <button 
                  onClick={deepScan} 
                  disabled={isDeepScanning || loadingGallery}
                  className="hover:text-[#FFE600] flex items-center gap-2 uppercase font-black"
                >
                  Rescue Scan {isDeepScanning && <Loader2 size={10} className="animate-spin" />}
                </button>
                <div className="w-[1px] h-3 bg-[#222]" />
                <button 
                  onClick={() => fetchGallery()} 
                  className="hover:text-[#FFE600] flex items-center gap-2 uppercase font-black"
                  disabled={loadingGallery}
                >
                  Sync {loadingGallery && <Loader2 size={10} className="animate-spin" />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
              {(() => {
                const displayedItems = galleryItems.filter((item) => {
                  const isOwned = item.hasAccess || address?.toLowerCase() === item.creator.toLowerCase();
                  return activeTab === "gallery" ? !isOwned : isOwned;
                });

                if (loadingGallery && galleryItems.length === 0) {
                  return (
                    <div className="h-32 flex items-center justify-center border-2 border-dashed border-[#222]">
                      <Loader2 size={24} className="animate-spin text-[#333]" />
                    </div>
                  );
                }

                if (displayedItems.length === 0) {
                  return (
                    <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-[#222]">
                      <p className="text-[10px] font-mono text-[#444] uppercase tracking-widest">No data available</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 gap-4 pb-4">
                    {displayedItems.map((item) => {
                      const Icon = TYPE_ICONS[item.type] || FileText;
                      const isOwned = item.hasAccess || address?.toLowerCase() === item.creator.toLowerCase();
                      const insufficient = (parseFloat(contractBalance || "0") < Number(item.price) / 1e18);
                      const isLoadingUnlock = unlockingId === item.id;

                      return (
                        <div key={item.id.toString()} className="border-2 border-[var(--border-main)] bg-[var(--bg-page)] p-4 flex flex-col gap-4 relative">
                          {isOwned && <div className="absolute top-0 right-0 p-1 bg-[#00FF87] text-black text-[8px] font-black uppercase">Owned</div>}
                          
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 border-2 ${COLORS[item.type]}`}>
                                <Icon size={14} />
                              </div>
                              <div>
                                <h3 className="text-xs font-black text-[var(--text-main)] uppercase tracking-tight">{item.title}</h3>
                                <p className="text-[9px] font-mono text-[var(--text-dim)] mt-0.5">#{item.id.toString()} | BY {item.creator.slice(0,6)}...{item.creator.slice(-4)}</p>
                              </div>
                            </div>
                            <div className="text-[10px] font-black text-[#FFE600] font-mono whitespace-nowrap">
                              {(Number(item.price) / 1e18).toFixed(4)} USDC
                            </div>
                          </div>

                          <p className="text-[10px] font-mono text-[#888] leading-normal">{item.description}</p>
                          
                          {item.payouts.length > 0 && !isOwned && (
                            <div className="flex items-center gap-2 px-2 py-1 bg-[#111] border border-[#333] w-fit">
                              <Timer size={10} className="text-[#FFE600]" />
                              <span className="text-[8px] font-mono text-[#FFE600] uppercase">Escrow Active</span>
                            </div>
                          )}

                          {isOwned ? (
                            <div className="border-2 border-[#00FF87]/20 bg-[#00FF87]/5 p-3">
                              <div className="flex justify-between items-center mb-2">
                                <p className="text-[9px] font-black text-[#008A4B] dark:text-[#00FF87] uppercase flex items-center gap-1"><CheckCircle2 size={10} /> Validated Access</p>
                                {item.payouts[0] && !item.payouts[0].isDisputed && !item.payouts[0].resolved && (
                                  <button 
                                    onClick={() => handleDispute(item.id, 0)}
                                    disabled={disputingId === item.id}
                                    className="text-[8px] font-black uppercase text-[#FF3B3B] hover:underline"
                                  >
                                    Report Scam
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-col gap-2">
                                <p className="text-[10px] font-mono text-[var(--text-main)] opacity-80 break-all p-2 bg-[var(--bg-page)] border border-[#00FF87]/20">
                                  {item.payouts[0]?.isDisputed ? "[ DISPUTE OPEN: FUNDS FROZEN ]" : (revealedSecrets[item.id.toString()] || "SECRET CONTENT GATING (LIT PROTOCOL)")}
                                </p>
                                
                                {!revealedSecrets[item.id.toString()] && !item.payouts[0]?.isDisputed && (
                                  <button
                                    onClick={() => handleReveal(item)}
                                    disabled={revealingId === item.id}
                                    className="brut-btn brut-btn-green w-full text-[10px] h-8"
                                  >
                                    {revealingId === item.id ? <Loader2 size={10} className="animate-spin mr-2" /> : <LockKeyhole size={10} className="mr-2" />}
                                    Reveal Secret Content
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleUnlock(item.id, item.price)}
                              disabled={isDisabled || insufficient || isLoadingUnlock}
                              className={`brut-btn w-full ${insufficient ? "brut-btn-red opacity-50" : "brut-btn-white"}`}
                            >
                              {isLoadingUnlock ? <Loader2 size={12} className="animate-spin" /> : <LockKeyhole size={12} />}
                              {insufficient ? "Insufficient Funds" : "Unlock Asset"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
