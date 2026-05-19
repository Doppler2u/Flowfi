import { readFileSync } from "fs";
import path from "path";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const env = Object.fromEntries(
  readFileSync(".env", "utf-8").split("\n")
    .filter(l => l.includes("="))
    .map(l => l.trim().split("="))
);

const privateKey = env["PRIVATE_KEY"];
if (!privateKey) { console.error("PRIVATE_KEY not in .env"); process.exit(1); }

const account = createAccount(privateKey);
const client = createClient({ chain: studionet, account });

async function main() {
  const contractCode = new Uint8Array(
    readFileSync(path.resolve("contracts/FlowFiArbiter.py"))
  );

  const hash = await client.deployContract({ code: contractCode, args: [] });
  console.log("TX Hash:", hash);

  const receipt = await client.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 200 });
  console.log("✅ FlowFiArbiter deployed at:", receipt.data?.contract_address);
}

main();
