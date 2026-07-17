// relayer.js
// FlowFi ↔ GenLayer Oracle Relayer
// Listens for DisputeRaised on Arc Testnet → triggers GenLayer → posts verdict back to Arc
//
// Usage: node relayer.js
// Requires .env with: PRIVATE_KEY, FLOWFI_CONTRACT_ARC, ARBITER_CONTRACT_GENLAYER

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { readFileSync } from "fs";
import path from "path";
import { createServer } from "http";

// ── Config ───────────────────────────────────────────────────────────────────
const PRIVATE_KEY           = process.env.PRIVATE_KEY;
const FLOWFI_ARC_ADDRESS    = process.env.FLOWFI_CONTRACT_ARC;
const ARBITER_GL_ADDRESS    = process.env.ARBITER_CONTRACT_GENLAYER;
const POLL_INTERVAL_MS      = 5000;
const MAX_WAIT_MS           = 900000; // 15 minutes — GenLayer consensus can take 5-10 min

if (!PRIVATE_KEY || !FLOWFI_ARC_ADDRESS || !ARBITER_GL_ADDRESS) {
  console.error("❌ Missing required environment variables. Set PRIVATE_KEY, FLOWFI_CONTRACT_ARC, ARBITER_CONTRACT_GENLAYER.");
  process.exit(1);
}

// ── Arc Testnet chain definition ──────────────────────────────────────────────
const arcTestnet = {
  id: 5042002, // Arc Testnet
  name: "Arc Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
};

// ── ABIs ─────────────────────────────────────────────────────────────────────
// Full ABI definition is more reliable than parseAbiItem for watchContractEvent decoding
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

const SET_RELAYER_ABI = [{
  name: "setRelayer",
  type: "function",
  inputs: [{ name: "_relayer", type: "address" }],
  outputs: [],
}];

// ── Clients ───────────────────────────────────────────────────────────────────
const account = privateKeyToAccount(PRIVATE_KEY);

// Arc clients (viem)
const arcPublic = createPublicClient({ chain: arcTestnet, transport: http() });
const arcWallet = createWalletClient({ account, chain: arcTestnet, transport: http() });

// GenLayer client (genlayer-js)
const glAccount = createAccount(PRIVATE_KEY);
const glClient  = createClient({ chain: studionet, account: glAccount });

// ── Core Functions ────────────────────────────────────────────────────────────

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
  // get_verdict returns a JSON string — parse it
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

  // Before throwing, do one last check — GenLayer may have finalized during the timeout
  const finalCheck = await getVerdictFromGenLayer(disputeId);
  if (finalCheck && finalCheck.status === "RESOLVED") {
    console.log(`[GenLayer] Verdict found on final check:`, finalCheck);
    return finalCheck;
  }

  throw new Error(`[GenLayer] Timeout waiting for verdict on dispute ${disputeId}`);
}

async function postVerdictToArc(contentId, payoutIndex, isScam) {
  console.log(`[Arc] Posting verdict — contentId: ${contentId}, payoutIndex: ${payoutIndex}, refundBuyer (isScam): ${isScam}`);
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

  // Fetch the CID directly from the contract since it's not in the event
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
    // 1. Trigger GenLayer AI arbitration
    await triggerArbitration(disputeId, cid, contentUrl, taskDescription);

    // 2. Wait for consensus verdict
    const verdict = await pollForVerdict(disputeId);

    // 3. Post verdict back to Arc (is_scam = refundBuyer)
    await postVerdictToArc(contentId, payoutIndex, verdict.is_scam);

    console.log(`✅ Dispute ${disputeId} fully resolved.`);
    console.log(`   is_scam: ${verdict.is_scam}`);
    console.log(`   confidence: ${verdict.confidence}%`);
    console.log(`   reasoning: ${verdict.reasoning}`);

  } catch (err) {
    console.error(`❌ Dispute ${disputeId} failed:`, err.message);
    // TODO: alert admin for manual fallback
  }
}

// ── Start Relayer ─────────────────────────────────────────────────────────────

async function startRelayer() {
  console.log("🔗 FlowFi ↔ GenLayer Relayer started");
  console.log(`   Watching Arc: ${FLOWFI_ARC_ADDRESS}`);
  console.log(`   GenLayer Arbiter: ${ARBITER_GL_ADDRESS}`);
  console.log(`   Relayer wallet: ${account.address}\n`);

  arcPublic.watchContractEvent({
    address: FLOWFI_ARC_ADDRESS,
    abi: [DISPUTE_RAISED_EVENT],
    eventName: "DisputeRaised",
    onLogs: (logs) => {
      for (const log of logs) {
        if (!log.args) {
          console.error("[Arc] Received log with no args, skipping.", log);
          continue;
        }
        handleDisputeRaised(log);
      }
    },
    onError: (err) => console.error("[Arc] Event watch error:", err),
  });
}

// ── Start Keep-Alive Server ───────────────────────────────────────────────────
createServer((req, res) => res.end("FlowFi Relayer is awake!")).listen(process.env.PORT || 10000, () => {
  console.log(`🌐 Keep-alive HTTP server listening on port ${process.env.PORT || 10000}`);
});

startRelayer();
