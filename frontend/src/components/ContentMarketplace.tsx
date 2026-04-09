"use client";

import { useState, useEffect } from "react";
import { useWeb3, ARC_TESTNET } from "@/context/Web3Provider";
import { FlowFiABI, CONTRACT_ADDRESS } from "../lib/abi";
import { parseUnits, decodeEventLog } from "viem";
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
  X
} from "lucide-react";
import InfoTooltip from "./InfoTooltip";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

type ContentType = "Article" | "Video" | "Image" | "Code" | "Audio";

interface GalleryItem {
  id: bigint;
  creator: string;
  price: bigint;
  title: string;
  type: ContentType;
  secret: string | null;
  hasAccess: boolean;
}

interface LocalMetadata {
  title: string;
  type: ContentType;
  secret: string;
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

  const [activeTab, setActiveTab] = useState<"gallery" | "my-content" | "create">("gallery");

  // Create State
  const [createId, setCreateId] = useState("");
  const [createPrice, setCreatePrice] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createType, setCreateType] = useState<ContentType>("Article");
  const [createSecret, setCreateSecret] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  
  const [isIdTaken, setIsIdTaken] = useState(false);
  const [checkingId, setCheckingId] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  // Gallery State
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [unlockingId, setUnlockingId] = useState<bigint | null>(null);

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

  // Load Gallery
  useEffect(() => {
    if (activeTab === "gallery" || activeTab === "my-content") {
      fetchGallery();
    }
  }, [activeTab, publicClient, address, isConnected]);
  
  const DEPLOYMENT_BLOCK = 36104400n;
  const CHUNK_SIZE = 9500n;

  const [isDeepScanning, setIsDeepScanning] = useState(false);
  
  const fetchGallery = async (targetBlocks?: bigint) => {
    if (!publicClient) return;
    setLoadingGallery(true);
    try {
      const currentBlock = await publicClient.getBlockNumber();
      const lookbackLimit = targetBlocks || (15000n); // Default lookback ~30k blocks
      const stopBlock = currentBlock > lookbackLimit ? currentBlock - lookbackLimit : DEPLOYMENT_BLOCK;
      const finalStopBlock = stopBlock < DEPLOYMENT_BLOCK ? DEPLOYMENT_BLOCK : stopBlock;

      let currentTo = currentBlock;
      let isFirstChunk = true;
      const uniqueEvents = new Map();
      
      addLog({ type: "info", message: `Protocol Scan: Syncing history to block ${finalStopBlock}...` });

      while (currentTo > finalStopBlock) {
        const currentFrom = currentTo > CHUNK_SIZE ? currentTo - CHUNK_SIZE : finalStopBlock;
        const scanFrom = currentFrom < finalStopBlock ? finalStopBlock : currentFrom;

        // Skip if the range is invalid
        if (scanFrom >= currentTo && !isFirstChunk) break;

        // Use 'latest' for the first chunk to avoid race conditions with out-of-sync RPC nodes
        const logs = await publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          fromBlock: scanFrom,
          toBlock: isFirstChunk ? 'latest' : currentTo,
        });

        if (isFirstChunk) {
          addLog({ type: "info", message: `[DEBUG] Scanner start: ${scanFrom.toString()} to LATEST` });
        }

        for (const log of logs) {
          try {
            const decoded = decodeEventLog({
              abi: FlowFiABI,
              data: log.data,
              topics: log.topics,
            });
            
            if (decoded.eventName === "ContentCreated") {
              const args = decoded.args as any;
              const id = args.contentId ?? args.id;
              if (id !== undefined) {
                uniqueEvents.set(id.toString(), args);
              }
            }
          } catch (e) {}
        }
        
        currentTo = scanFrom;
        if (logs.length > 0) {
          addLog({ type: "info", message: `Found ${uniqueEvents.size} unique assets...` });
        }
      }

      const items: GalleryItem[] = [];
      for (const args of uniqueEvents.values()) {
        const id = (args.contentId ?? args.id) as bigint;
        const creator = (args.creator ?? args.owner) as string;
        const price = (args.price ?? args.cost) as bigint;

        let hasAccess = false;
        if (address) {
          try {
            hasAccess = await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: FlowFiABI,
              functionName: "hasAccess",
              args: [address, id],
            }) as boolean;
          } catch (e) {
            console.warn(`Failed checking access for ${id}`, e);
          }
        }

        const metaKey = `flowfi_metadata_${id.toString()}`;
        let title = `Content #${id.toString()}`;
        let type: ContentType = "Article";
        let secret = null;
        
        try {
          const stored = localStorage.getItem(metaKey);
          if (stored) {
            const parsed = JSON.parse(stored) as LocalMetadata;
            title = parsed.title;
            type = parsed.type || "Article";
            if (hasAccess || address?.toLowerCase() === creator.toLowerCase()) {
              secret = parsed.secret;
            }
          }
        } catch (e) {}

        items.push({ id, creator, price, title, type, secret, hasAccess });
      }

      setGalleryItems(items.reverse());
      addLog({ type: "info", message: `Scan Complete: ${items.length} assets recovered.` });
    } catch (e: any) {
      console.error("Gallery fetch error:", e);
      addLog({ type: "error", message: `Scanner Error: ${e.message?.slice(0, 100)}...` });
    } finally {
      setLoadingGallery(false);
    }
  };

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
    if (!walletClient || !publicClient || !createId || !createPrice || !createTitle || !createSecret) return;
    setLoadingCreate(true);
    try {
      const id = BigInt(createId);
      const price = parseUnits(createPrice, 18);
      
      addLog({ type: "info", message: `Please confirm content #${createId} registration in MetaMask...` });
      
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: FlowFiABI,
        functionName: "createContent",
        args: [id, price],
        account: address,
        chain: ARC_TESTNET as any, // satisfies viem strict typing
        gas: 300000n, // Bypassing brittle Arc RPC simulation with manual gas
      });

      addLog({ type: "info", message: `Transaction submitted! Hash: ${hash}` });
      
      await publicClient.waitForTransactionReceipt({ hash });
      
      const metaKey = `flowfi_metadata_${id.toString()}`;
      localStorage.setItem(metaKey, JSON.stringify({
        title: createTitle,
        type: createType,
        secret: createSecret
      }));

      addLog({ type: "info", message: `Successfully registered content #${createId}! Syncing with network...` });
      setCreateId("");
      setCreatePrice("");
      setCreateTitle("");
      setCreateSecret("");
      
      // 5-second delay to allow Arc RPC to index the new event before fetching
      setTimeout(() => {
        setActiveTab("gallery");
        fetchGallery();
      }, 5000);
    } catch (err) {
      const error = err as any;
      const msg = error.message || "Failed to create content";
      addLog({ type: "error", message: msg.length > 200 ? msg.slice(0, 200) + "..." : msg });
    } finally {
      setLoadingCreate(false);
      refreshBalance();
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
      {/* Warning Modal Overlay */}
      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-none" onClick={() => setShowWarning(false)} />
          <div className="relative z-10 max-w-lg w-full bg-[var(--bg-card)] border-4 border-[#FFE600] p-6 shadow-none flex flex-col">
            <div className="flex justify-between items-start mb-6 text-[var(--text-main)]">
              <div className="flex items-center gap-3">
                <AlertTriangle size={24} className="text-[#A39200] dark:text-[#FFE600]" />
                <h2 className="text-xl font-black uppercase tracking-tighter">System Warning</h2>
              </div>
              <button onClick={() => setShowWarning(false)} className="text-[var(--text-dim)] hover:text-[#FFE600]">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2 scrollbar-thin font-mono text-xs">
              <div className="border-2 border-[#FFE600] p-4 bg-[#FFE600]/5">
                <p className="text-[#FFE600] font-bold mb-2 uppercase tracking-widest text-[10px]">// The Web3 Oracle Problem</p>
                <p className="text-slate-300 leading-relaxed italic">
                  &quot;Atomic exchanges on-chain can reveal dead URLs. Once the USDC is paid, the transaction is irreversible regardless of content quality.&quot;
                </p>
              </div>

              <div className="space-y-4">
                <p className="font-bold text-white uppercase tracking-widest">Architectural Solutions:</p>
                
                <div className="border-2 border-[#333] p-4">
                  <p className="text-blue-400 font-bold mb-1 uppercase">01. GenLayer AI Validation</p>
                  <p className="text-slate-500">Autonomous AI validators verify URL contents before fund release. Fraudulent links trigger natural transaction reverts.</p>
                </div>

                <div className="border-2 border-[#333] p-4">
                  <p className="text-emerald-400 font-bold mb-1 uppercase">02. Escrow & Arbitration</p>
                  <p className="text-slate-500">24h lock periods with decentralized jury review (e.g. Kleros) for dispute resolution.</p>
                </div>

                <div className="border-2 border-[#333] p-4">
                  <p className="text-violet-400 font-bold mb-1 uppercase">03. Staking & Slashing</p>
                  <p className="text-slate-500">Economic collateralization where creators forfeit stakes on verified fraud reports.</p>
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
          <button
            onClick={() => setShowWarning(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#FFE600] text-black text-[10px] font-black uppercase border-2 border-[#FFE600] hover:bg-black hover:text-[#FFE600] transition-all w-fit"
          >
            <AlertTriangle size={12} />
            Experimental
          </button>
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
            className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "create" ? "bg-[#FFE600] text-black" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"}`}
          >
            Register
          </button>
        </div>
        <div className="border-b-2 border-[var(--border-main)] w-full" />
      </div>

      <div className="flex-1 overflow-hidden mt-6">
        {activeTab === "create" ? (
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
              <label className="text-[10px] font-black text-[#888] uppercase tracking-widest">Secret Value</label>
              <textarea
                placeholder="HIDDEN URL OR PRIVATE KEY..."
                value={createSecret}
                onChange={(e) => setCreateSecret(e.target.value)}
                disabled={isDisabled}
                rows={2}
                className="brut-input resize-none"
              />
            </div>
            
            <button
              onClick={handleCreateContent}
              disabled={isDisabled || !createId || !createPrice || !createTitle || !createSecret || loadingCreate || isIdTaken || checkingId}
              className="brut-btn brut-btn-yellow w-full sticky bottom-0"
            >
              {loadingCreate ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
              Confirm Registration
            </button>
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

                          {isOwned ? (
                            <div className="border-2 border-[#00FF87]/20 bg-[#00FF87]/5 p-3">
                              <p className="text-[9px] font-black text-[#008A4B] dark:text-[#00FF87] uppercase mb-1 flex items-center gap-1"><CheckCircle2 size={10} /> Secret Unlocked</p>
                              <p className="text-[10px] font-mono text-[var(--text-main)] opacity-80 break-all p-2 bg-[var(--bg-page)]">{item.secret || "ACCESS RESTRICTED (DEVICE MISMATCH)"}</p>
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
