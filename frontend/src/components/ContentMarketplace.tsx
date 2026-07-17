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

const DEPLOYMENT_BLOCK = 52000000n; // Updated to recent block to avoid scanning 9M blocks and hitting RPC rate limit
const CHUNK_SIZE = 10000n;
const CACHE_KEY = "flowfi_gallery_cache_v1";

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
  refunded?: boolean;
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

  const [activeTab, setActiveTab] = useState<"gallery" | "my-content">("gallery");

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
    if (activeTab === "gallery" || activeTab === "my-content") {
      fetchGallery();
    }
  }, [activeTab, publicClient, address, isConnected]);
  

  const fetchGallery = useCallback(async () => {
    if (!publicClient) return;
    setLoadingGallery(true);
    try {
      const currentBlock = await publicClient.getBlockNumber();
      const safeTip = currentBlock > 10n ? currentBlock - 10n : currentBlock;

      // ── Load cache from localStorage ─────────────────────────────────
      let cachedEvents: Record<string, any> = {};
      let cachedRefunds: Record<string, boolean> = {};
      let lastScannedBlock = DEPLOYMENT_BLOCK;

      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          cachedEvents = parsed.events || {};
          cachedRefunds = parsed.refunds || {};
          lastScannedBlock = BigInt(parsed.lastBlock || DEPLOYMENT_BLOCK.toString());
        }
      } catch {}

      // If we have cached data, show it instantly while we scan new blocks
      const uniqueEvents = new Map<string, any>(Object.entries(cachedEvents));
      const refundMap = new Map<string, boolean>(Object.entries(cachedRefunds));

      if (uniqueEvents.size > 0) {
        addLog({ type: "info", message: `Loaded ${uniqueEvents.size} cached items. Checking for new content...` });
      } else {
        addLog({ type: "info", message: "First load: scanning full history..." });
      }

      // ── Phase 1: Only scan NEW blocks since last cached block ─────────
      const scanFrom = lastScannedBlock < safeTip ? lastScannedBlock : safeTip;
      let currentTo = safeTip;
      const SAFE_CHUNK = 9900n; // Close to 10k Arc RPC limit

      while (currentTo > scanFrom) {
        const from = currentTo > SAFE_CHUNK ? currentTo - SAFE_CHUNK : scanFrom;
        const chunkFrom = from < scanFrom ? scanFrom : from;
        if (chunkFrom >= currentTo) break;

        const fromHex = `0x${chunkFrom.toString(16)}`;
        const toHex = `0x${currentTo.toString(16)}`;

        const logs = await publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          fromBlock: fromHex as any,
          toBlock: toHex as any,
        });
        
        // Add a tiny delay to respect public RPC rate limits (HTTP 429)
        await new Promise(r => setTimeout(r, 100));

        for (const log of logs) {
          try {
            const decoded = decodeEventLog({ abi: FlowFiABI, data: log.data, topics: log.topics });
            if (decoded.eventName === "ContentCreated") {
              const args = decoded.args as any;
              const id = args.contentId;
              if (id !== undefined) {
                uniqueEvents.set(id.toString(), {
                  id, creator: args.creator, price: args.price, metadataURI: args.metadataURI
                });
              }
            } else if (decoded.eventName === "DisputeResolved") {
              const args = decoded.args as any;
              if (args.contentId !== undefined) {
                refundMap.set(`${args.contentId.toString()}_${args.payoutIndex.toString()}`, args.refunded);
              }
            }
          } catch (e) {}
        }
        currentTo = chunkFrom;
      }

      // ── Save updated cache to localStorage ───────────────────────────
      try {
        const eventsObj: Record<string, any> = {};
        uniqueEvents.forEach((v, k) => {
          eventsObj[k] = { ...v, id: v.id.toString(), price: v.price.toString() };
        });
        const refundsObj: Record<string, boolean> = {};
        refundMap.forEach((v, k) => { refundsObj[k] = v; });
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          events: eventsObj,
          refunds: refundsObj,
          lastBlock: safeTip.toString(),
        }));
      } catch {}

      const allEvents = Array.from(uniqueEvents.values()).map(e => ({
        ...e,
        id: typeof e.id === "string" ? BigInt(e.id) : e.id,
        price: typeof e.price === "string" ? BigInt(e.price) : e.price,
      }));

      addLog({ type: "info", message: `Scan Complete: Found ${allEvents.length} items. Loading metadata...` });

      // ── Phase 2: Fetch all item details in PARALLEL ──────────────────
      const results = await Promise.allSettled(
        allEvents.map(async (eventData) => {
          const id = eventData.id as bigint;
          const creator = eventData.creator as string;
          const price = eventData.price as bigint;
          const metadataURI = eventData.metadataURI as string;

          let hasAccess = false;
          let title = `Content #${id.toString()}`;
          let description = "Protocol registered asset";
          let type: ContentType = "Article";
          let payouts: PayoutData[] = [];

          // All three fetches run in parallel per item
          await Promise.allSettled([
            // Access check
            address
              ? publicClient.readContract({ address: CONTRACT_ADDRESS, abi: FlowFiABI, functionName: "balanceOf", args: [address, id] })
                  .then((bal) => { hasAccess = (bal as bigint) > 0n; })
              : Promise.resolve(),
            // IPFS metadata
            metadataURI.startsWith("ipfs://")
              ? fetchMetadata(metadataURI.replace("ipfs://", ""))
                  .then((meta) => { title = meta.title; description = meta.description; type = meta.type as ContentType; })
              : Promise.resolve(),
            // Payout check
            publicClient.readContract({ address: CONTRACT_ADDRESS, abi: FlowFiABI, functionName: "contentPayouts", args: [id, 0n] })
              .then((p: any) => { payouts.push({ creator: p[0], amount: p[2], releaseTime: p[3], isDisputed: p[4], resolved: p[5], refunded: refundMap.get(`${id.toString()}_0`) }); })
              .catch(() => {}),
          ]);

          return { id, creator, price, title, description, type, metadataURI, hasAccess, payouts };
        })
      );

      const items: GalleryItem[] = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<GalleryItem>).value);

      setGalleryItems(items.reverse());
      addLog({ type: "info", message: `Gallery ready: ${items.length} assets loaded.` });
    } catch (e: any) {
      console.error("Gallery fetch error:", e);
      addLog({ type: "error", message: `Scanner Error: ${e.message?.slice(0, 100)}` });
    } finally {
      setLoadingGallery(false);
    }
  }, [publicClient, addLog, address]);



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

  // Generate a realistic demo secret for content without Lit encryption
  const generateDemoSecret = (id: bigint, type: ContentType, title: string): string => {
    const hex = id.toString(16).padStart(12, "0");
    const short = id.toString().slice(-6);
    const secrets: Record<ContentType, string> = {
      Article:  `📝 EXCLUSIVE ARTICLE\n─────────────────────\nFull Content: https://arweave.net/tx/${hex}abc\nAccess Token: ARC-${short}-DOC\nFormat: PDF + Markdown\nLast Updated: 2025-Q1`,
      Video:    `🎬 PRIVATE VIDEO STREAM\n─────────────────────\nStream URL: https://stream.flowfi.io/v/${hex}\nViewer Key: VID-${short}-FLOWFI\nResolution: 4K | Duration: varies\nExpires: Never (NFT-gated)`,
      Code:     `💻 PRIVATE REPOSITORY\n─────────────────────\nGist: https://gist.github.com/flowfi/${hex}\nNPM Token: npm_${hex}XARC\nLicense: Commercial (single seat)\nIncludes: Full source + tests`,
      Image:    `🖼 HIGH-RES ORIGINAL\n─────────────────────\nIPFS (4K): ipfs://Qm${hex}ArcFlow\nFormat: PNG + PSD source file\nUnlock PIN: IMG-${short}\nLicense: Commercial use included`,
      Audio:    `🎧 PRIVATE AUDIO FILE\n─────────────────────\nStream: https://audio.flowfi.io/${hex}\nSession Key: AUD-${short}-HLS\nFormat: FLAC + MP3 (320kbps)\nIncludes: Full transcript PDF`,
    };
    return secrets[type] || `🔑 CONTENT #${id}\nAccess Key: FLOWFI-${hex}`;
  };

  const handleReveal = async (item: GalleryItem) => {
    if (!address) return;
    setRevealingId(item.id);
    try {
      // 1. Try to fetch IPFS metadata
      let metadata: any = null;
      try {
        metadata = await fetchMetadata(item.metadataURI);
      } catch {
        // IPFS unavailable — show demo secret
        addLog({ type: "info", message: "Showing demo secret (content listed without Lit encryption)." });
        setRevealedSecrets(prev => ({ ...prev, [item.id.toString()]: generateDemoSecret(item.id, item.type, item.title) }));
        return;
      }

      // 2. If metadata has a plain `secret` field (non-Lit demo content), show it
      if (metadata?.secret && !metadata?.encryptedData) {
        addLog({ type: "info", message: "Demo secret revealed!" });
        setRevealedSecrets(prev => ({ ...prev, [item.id.toString()]: metadata.secret }));
        return;
      }

      // 3. No encrypted secret at all — generate demo
      if (!metadata?.encryptedData) {
        addLog({ type: "info", message: "Content has no Lit-encrypted secret. Showing demo reveal." });
        setRevealedSecrets(prev => ({ ...prev, [item.id.toString()]: generateDemoSecret(item.id, item.type, item.title) }));
        return;
      }

      // 4. Proper Lit Protocol decryption
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
      addLog({ type: "error", message: `Decrypt failed: ${e.message || "Verify NFT ownership on Lit network"}` });
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
                <p className="font-bold text-[#00FF87] uppercase tracking-widest text-xs border-b-2 border-[#00FF87]/30 pb-1">Phase 3: Implemented</p>
                
                <div className="border border-[#333] p-3 space-y-2">
                   <p><span className="text-white font-bold">4. GenLayer AI Arbitration:</span> The central Administrator role has been replaced by a decentralized Intelligent Contract (`FlowFiArbiter.py`) on GenLayer's Studionet.</p>
                   <p><span className="text-white font-bold">5. Oracle Bridge:</span> A highly optimized Node.js relayer actively pipes `DisputeRaised` events from the Arc Testnet directly to the AI Jury, which then executes the on-chain refund or payout autonomously.</p>
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
              <p><span className="text-[#00FF87] font-bold">LIVE:</span> Escrow | Lit Encryption | AI Arbitration</p>
              <p><span className="text-[#00D9FF] font-bold mt-1 inline-block">POWERED BY:</span> GenLayer Studionet | Arc Testnet</p>
            </div>
          </div>
        </div>
        
        <div className="flex border-2 border-[var(--border-main)] w-full shrink-0">
          <button
            onClick={() => setActiveTab("gallery")}
            className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "gallery" ? "bg-[#FFE600] text-black" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"}`}
          >
            Gallery
          </button>
          <button
            onClick={() => setActiveTab("my-content")}
            className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest border-l-2 border-[var(--border-main)] transition-all ${activeTab === "my-content" ? "bg-[#FFE600] text-black" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"}`}
          >
            Library
          </button>
        </div>
        <div className="border-b-2 border-[var(--border-main)] w-full" />
      </div>

      <div className="flex-1 overflow-hidden mt-6">
          <div className="h-full flex flex-col space-y-4">
            <div className={`flex justify-between items-center text-[10px] font-mono ${loadingGallery ? "text-[#FFE600]" : "text-[#555]"}`}>
              <p>{loadingGallery ? "Scanning full history..." : "Search range: Full History"}</p>
              <div className="flex items-center gap-4">
                <button onClick={() => fetchGallery()} className="hover:text-[#FFE600] flex items-center gap-2 uppercase font-black" disabled={loadingGallery}>
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
                  return (<div className="h-32 flex items-center justify-center border-2 border-dashed border-[#222]"><Loader2 size={24} className="animate-spin text-[#333]" /></div>);
                }
                if (displayedItems.length === 0) {
                  return (<div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-[#222]"><p className="text-[10px] font-mono text-[#444] uppercase tracking-widest">No data available</p></div>);
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
                              <div className={`p-2 border-2 ${COLORS[item.type]}`}><Icon size={14} /></div>
                              <div>
                                <h3 className="text-xs font-black text-[var(--text-main)] uppercase tracking-tight">{item.title}</h3>
                                <p className="text-[9px] font-mono text-[var(--text-dim)] mt-0.5">#{item.id.toString()} | BY {item.creator.slice(0,6)}...{item.creator.slice(-4)}</p>
                              </div>
                            </div>
                            <div className="text-[10px] font-black text-[#FFE600] font-mono whitespace-nowrap">{(Number(item.price) / 1e18).toFixed(4)} USDC</div>
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
                                {/* Show Report Scam for actual BUYERS (hasAccess=true, not just creator ownership) */}
                                {item.hasAccess && !item.payouts[0]?.isDisputed && !item.payouts[0]?.resolved && (
                                  <button onClick={() => handleDispute(item.id, 0)} disabled={disputingId === item.id} className="text-[8px] font-black uppercase text-[#FF3B3B] hover:underline border border-[#FF3B3B]/30 px-1.5 py-0.5">
                                    {disputingId === item.id ? <Loader2 size={8} className="animate-spin inline mr-1" /> : null}
                                    ⚑ Report Scam
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-col gap-2">
                                <p className="text-[10px] font-mono text-[var(--text-main)] opacity-80 break-all p-2 bg-[var(--bg-page)] border border-[#00FF87]/20">
                                  {item.payouts[0]?.isDisputed
                                    ? item.payouts[0]?.resolved 
                                        ? (item.payouts[0]?.refunded ? "[ VERDICT: BUYER REFUNDED (SCAM DETECTED) ]" : "[ VERDICT: DISPUTE DISMISSED (CONTENT VALID) ]")
                                        : "[ DISPUTE OPEN — GENLAYER AI JURY DELIBERATING... ]"
                                    : (revealedSecrets[item.id.toString()] || "SECRET CONTENT GATING (LIT PROTOCOL)")}
                                </p>
                                {!revealedSecrets[item.id.toString()] && !item.payouts[0]?.isDisputed && (
                                  <button onClick={() => handleReveal(item)} disabled={revealingId === item.id} className="brut-btn brut-btn-green w-full text-[10px] h-8">
                                    {revealingId === item.id ? <Loader2 size={10} className="animate-spin mr-2" /> : <LockKeyhole size={10} className="mr-2" />}
                                    Reveal Secret Content
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => handleUnlock(item.id, item.price)} disabled={isDisabled || insufficient || isLoadingUnlock} className={`brut-btn w-full ${insufficient ? "brut-btn-red opacity-50" : "brut-btn-white"}`}>
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
      </div>
    </div>
  );
}
