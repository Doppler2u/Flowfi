// relayer.js
// FlowFi ↔ GenLayer Oracle Relayer & Indexer
// Listens for DisputeRaised on Arc Testnet → triggers GenLayer → posts verdict back to Arc
// Also indexes ContentCreated and DisputeResolved events to serve the Gallery API
//
// Usage: node relayer.js
// Requires .env with: PRIVATE_KEY, FLOWFI_CONTRACT_ARC, ARBITER_CONTRACT_GENLAYER

import { createPublicClient, createWalletClient, http, decodeEventLog } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { createServer } from "http";

// ── Config ───────────────────────────────────────────────────────────────────
const PRIVATE_KEY           = process.env.PRIVATE_KEY;
const FLOWFI_ARC_ADDRESS    = process.env.FLOWFI_CONTRACT_ARC || "0x348cedA90058232b63ccFE1514B2cfbdcecb6e56";
const ARBITER_GL_ADDRESS    = process.env.ARBITER_CONTRACT_GENLAYER;
const POLL_INTERVAL_MS      = 5000;
const MAX_WAIT_MS           = 900000; 

// Indexer Config
const DEPLOYMENT_BLOCK      = 52220000n; // Moved much closer to current block to avoid IP rate limits on Render
const CHUNK_SIZE            = 2000n;

if (!PRIVATE_KEY || !FLOWFI_ARC_ADDRESS || !ARBITER_GL_ADDRESS) {
  console.error("❌ Missing required environment variables. Set PRIVATE_KEY, FLOWFI_CONTRACT_ARC, ARBITER_CONTRACT_GENLAYER.");
  process.exit(1);
}

// ── Arc Testnet chain definition ──────────────────────────────────────────────
const arcTestnet = {
  id: 5042002, 
  name: "Arc Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  // Using direct IP (208.115.227.31) as fallback to bypass Windows DNS lookup failures
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
};

// Resolve hostname manually to avoid Node.js DNS issues on Windows
const RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";

// ── ABIs ─────────────────────────────────────────────────────────────────────
const DISPUTE_RAISED_EVENT = {
  anonymous: false,
  name: "DisputeRaised",
  type: "event",
  inputs: [
    { indexed: true,  internalType: "uint256", name: "contentId",   type: "uint256" },
    { indexed: false, internalType: "uint256", name: "payoutIndex", type: "uint256" },
    { indexed: true,  internalType: "address", name: "reporter",    type: "address" },
  ],
};

const CONTENT_CREATED_EVENT = {
  anonymous: false,
  name: "ContentCreated",
  type: "event",
  inputs: [
    { indexed: true, internalType: "uint256", name: "contentId", type: "uint256" },
    { indexed: true, internalType: "address", name: "creator", type: "address" },
    { indexed: false, internalType: "uint256", name: "price", type: "uint256" },
    { indexed: false, internalType: "string", name: "metadataURI", type: "string" },
  ],
};

const DISPUTE_RESOLVED_EVENT = {
  anonymous: false,
  name: "DisputeResolved",
  type: "event",
  inputs: [
    { indexed: true, internalType: "uint256", name: "contentId", type: "uint256" },
    { indexed: false, internalType: "uint256", name: "payoutIndex", type: "uint256" },
    { indexed: false, internalType: "bool", name: "refunded", type: "bool" },
  ],
};

const FLOWFI_EVENTS_ABI = [DISPUTE_RAISED_EVENT, CONTENT_CREATED_EVENT, DISPUTE_RESOLVED_EVENT];

const RESOLVE_DISPUTE_ABI = [{
  name: "resolveDispute",
  type: "function",
  inputs: [
    { name: "id", type: "uint256" },
    { name: "payoutIndex", type: "uint256" },
    { name: "refundBuyer", type: "bool" },
  ],
  outputs: [],
}];

// ── State ─────────────────────────────────────────────────────────────────────
// Cache for the gallery indexer
const galleryCache = {
  events: {},   // { "contentId": { id, creator, price, metadataURI } }
  refunds: {},  // { "contentId_payoutIndex": boolean }
  lastBlock: DEPLOYMENT_BLOCK.toString()
};

function toJson(data) {
  return JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v);
}

// ── Clients ───────────────────────────────────────────────────────────────────
const account = privateKeyToAccount(PRIVATE_KEY);
const arcPublic = createPublicClient({ chain: arcTestnet, transport: http(RPC_URL) });
const arcWallet = createWalletClient({ account, chain: arcTestnet, transport: http(RPC_URL) });
const glAccount = createAccount(PRIVATE_KEY);
const glClient  = createClient({ chain: studionet, account: glAccount });

// ── Indexer Functions ─────────────────────────────────────────────────────────

function processLog(log) {
  try {
    const decoded = decodeEventLog({ abi: FLOWFI_EVENTS_ABI, data: log.data, topics: log.topics });
    if (decoded.eventName === "ContentCreated") {
      const args = decoded.args;
      galleryCache.events[args.contentId.toString()] = {
        id: args.contentId.toString(),
        creator: args.creator,
        price: args.price.toString(),
        metadataURI: args.metadataURI
      };
    } else if (decoded.eventName === "DisputeResolved") {
      const args = decoded.args;
      galleryCache.refunds[`${args.contentId.toString()}_${args.payoutIndex.toString()}`] = args.refunded;
    }
  } catch (e) {
    // Ignore unrelated events or parsing errors
  }
}

async function buildIndex() {
  console.log(`\n📚 [Indexer] Starting historical scan from block ${DEPLOYMENT_BLOCK}...`);
  const safeTip = await arcPublic.getBlockNumber();
  let currentTo = safeTip;
  const scanFrom = DEPLOYMENT_BLOCK;

  while (currentTo > scanFrom) {
    const from = currentTo > CHUNK_SIZE ? currentTo - CHUNK_SIZE : scanFrom;
    const chunkFrom = from < scanFrom ? scanFrom : from;
    if (chunkFrom >= currentTo) break;

    const fromHex = `0x${chunkFrom.toString(16)}`;
    const toHex = `0x${currentTo.toString(16)}`;

    let success = false;
    let retries = 3;
    
    while (!success && retries > 0) {
      try {
        const logs = await arcPublic.getLogs({
          address: FLOWFI_ARC_ADDRESS,
          fromBlock: fromHex,
          toBlock: toHex,
        });

        for (const log of logs) processLog(log);
        success = true;
      } catch (err) {
        console.warn(`[Indexer] RPC rate limit hit on chunk ${fromHex}-${toHex}. Retrying... (${retries} left)`);
        retries--;
        await new Promise(r => setTimeout(r, 2000)); // wait 2 seconds before retry
      }
    }
    
    if (!success) {
      console.error(`[Indexer] Failed to fetch chunk after retries. Aborting historical scan to prevent crash.`);
      break;
    }

    // Polite delay for public RPC - 2 seconds to heavily respect Render shared IP limits
    await new Promise(r => setTimeout(r, 2000));
    currentTo = chunkFrom;
  }
  
  galleryCache.lastBlock = safeTip.toString();
  console.log(`✅ [Indexer] Scan complete. Found ${Object.keys(galleryCache.events).length} assets.`);
}

// ── Core Functions (GenLayer Arbitration) ─────────────────────────────────────

async function triggerArbitration(disputeId, cid, contentUrl, taskDescription) {
  console.log(`[GenLayer] Triggering arbitration for dispute ${disputeId}...`);
  const hash = await glClient.writeContract({
    address: ARBITER_GL_ADDRESS,
    functionName: "arbitrate",
    args: [disputeId, cid, contentUrl, taskDescription],
  });
  console.log(`[GenLayer] TX sent: ${hash}`);
  await glClient.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 200 });
  console.log(`[GenLayer] Arbitration transaction accepted.`);
}

async function getVerdictFromGenLayer(disputeId) {
  const raw = await glClient.readContract({
    address: ARBITER_GL_ADDRESS,
    functionName: "get_verdict",
    args: [disputeId],
    jsonSafeReturn: true,
  });
  if (!raw || raw === "") return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

async function pollForVerdict(disputeId) {
  console.log(`[GenLayer] Polling for verdict on dispute ${disputeId}...`);
  const start = Date.now();

  while (Date.now() - start < MAX_WAIT_MS) {
    const verdict = await getVerdictFromGenLayer(disputeId);
    if (verdict && verdict.status === "RESOLVED") {
      console.log(`[GenLayer] Verdict received:`, verdict);
      return verdict;
    }
    console.log(`[GenLayer] Still deliberating... retrying in ${POLL_INTERVAL_MS / 1000}s`);
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  const finalCheck = await getVerdictFromGenLayer(disputeId);
  if (finalCheck && finalCheck.status === "RESOLVED") {
    console.log(`[GenLayer] Verdict found on final check:`, finalCheck);
    return finalCheck;
  }

  throw new Error(`[GenLayer] Timeout waiting for verdict on dispute ${disputeId}`);
}

async function postVerdictToArc(contentId, payoutIndex, isScam) {
  console.log(`[Arc] Posting verdict — contentId: ${contentId}, payoutIndex: ${payoutIndex}, refundBuyer: ${isScam}`);
  const hash = await arcWallet.writeContract({
    address: FLOWFI_ARC_ADDRESS,
    abi: RESOLVE_DISPUTE_ABI,
    functionName: "resolveDispute",
    args: [BigInt(contentId), BigInt(payoutIndex), isScam],
  });
  const receipt = await arcPublic.waitForTransactionReceipt({ hash });
  console.log(`[Arc] Dispute resolved on-chain. TX: ${hash}`);
  return receipt;
}

// ── Event Listener ────────────────────────────────────────────────────────────

async function handleDisputeRaised(log) {
  const { contentId, payoutIndex, reporter } = log.args;
  const disputeId = contentId.toString() + "_" + payoutIndex.toString();

  let cid = "unknown";
  try {
    const content = await arcPublic.readContract({
      address: FLOWFI_ARC_ADDRESS,
      abi: [{ name: "contents", type: "function", inputs: [{ name: "id", type: "uint256" }], outputs: [{ name: "creator", type: "address" }, { name: "price", type: "uint256" }, { name: "metadataURI", type: "string" }, { name: "exists", type: "bool" }] }],
      functionName: "contents",
      args: [contentId],
    });
    cid = content[2].replace("ipfs://", "");
  } catch(e) {
    console.error("Failed to fetch CID from contract", e);
  }

  const contentUrl = "Lit Protocol Encrypted Content";
  const taskDescription = "Encrypted Digital Asset Purchase";

  console.log(`\n========================================`);
  console.log(`[Arc] DisputeRaised detected!`);
  console.log(`  Content ID:   ${contentId}`);
  console.log(`  Payout Index: ${payoutIndex}`);
  console.log(`  Reporter:     ${reporter}`);
  console.log(`  IPFS CID:     ${cid}`);
  console.log(`========================================\n`);

  try {
    await triggerArbitration(disputeId, cid, contentUrl, taskDescription);
    const verdict = await pollForVerdict(disputeId);
    await postVerdictToArc(contentId, payoutIndex, verdict.is_scam);

    console.log(`✅ Dispute ${disputeId} fully resolved.`);
    console.log(`   is_scam: ${verdict.is_scam}`);
    console.log(`   confidence: ${verdict.confidence}%`);
    console.log(`   reasoning: ${verdict.reasoning}`);

  } catch (err) {
    console.error(`❌ Dispute ${disputeId} failed:`, err.message);
  }
}

// ── Start Relayer ─────────────────────────────────────────────────────────────

async function startRelayer() {
  console.log("🔗 FlowFi ↔ GenLayer Relayer started");
  console.log(`   Watching Arc: ${FLOWFI_ARC_ADDRESS}`);
  console.log(`   GenLayer Arbiter: ${ARBITER_GL_ADDRESS}`);
  console.log(`   Relayer wallet: ${account.address}\n`);

  // Build the gallery index first
  await buildIndex();

  // Then start watching for ALL events
  arcPublic.watchContractEvent({
    address: FLOWFI_ARC_ADDRESS,
    abi: FLOWFI_EVENTS_ABI,
    onLogs: (logs) => {
      for (const log of logs) {
        if (!log.args) continue;
        
        // Update index cache in real-time
        processLog(log);

        // If it's a dispute, trigger the AI arbitration pipeline
        if (log.topics[0] === '0x3213a7c6696b991ad34b07c80521ca49fbecc93961ef0aefedffb8b6a3ef83b5') {
          // This is the keccak256 hash for DisputeRaised, but viem parses args for us via decodeEventLog safely inside handleDisputeRaised if we manually decode.
          // Since viem 2.x, watchContractEvent with multiple ABIs returns the eventName
          // Let's decode it safely:
          try {
            const decoded = decodeEventLog({ abi: FLOWFI_EVENTS_ABI, data: log.data, topics: log.topics });
            if (decoded.eventName === "DisputeRaised") {
              handleDisputeRaised(decoded);
            }
          } catch(e) {}
        }
      }
    },
    onError: (err) => console.error("[Arc] Event watch error:", err),
  });
}

// ── API Server ───────────────────────────────────────────────────────────
createServer((req, res) => {
  // CORS setup
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  // Gallery Endpoint
  if (req.url === "/api/gallery" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(toJson(galleryCache));
    return;
  }

  // Default Keep-Alive
  res.writeHead(200);
  res.end("FlowFi Relayer & Indexer is awake!");
}).listen(process.env.PORT || 10000, () => {
  console.log(`🌐 Indexer API server listening on port ${process.env.PORT || 10000}`);
});

startRelayer();
