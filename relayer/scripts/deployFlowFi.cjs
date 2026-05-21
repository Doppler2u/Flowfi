const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const FlowFi = await ethers.getContractFactory("FlowFi");
  const flowfi = await FlowFi.deploy();
  await flowfi.waitForDeployment();

  const address = await flowfi.getAddress();
  console.log("✅ FlowFi deployed at:", address);

  // Set the relayer address so it can call resolveDispute
  const relayerWallet = "0x9EB59bD233F2897C4e5d7cD7bbe96F9B30235897";
  console.log("Setting relayer to:", relayerWallet);
  const tx = await flowfi.setRelayer(relayerWallet);
  await tx.wait();
  console.log("✅ Relayer set successfully");

  console.log("\n📋 Update these addresses:");
  console.log("   frontend/.env.local  → NEXT_PUBLIC_CONTRACT_ADDRESS=" + address);
  console.log("   relayer/.env         → FLOWFI_CONTRACT_ARC=" + address);
  console.log("   root .env            → NEXT_PUBLIC_CONTRACT_ADDRESS=" + address);
  console.log("   Vercel               → NEXT_PUBLIC_CONTRACT_ADDRESS=" + address);
  console.log("   Railway              → FLOWFI_CONTRACT_ARC=" + address);
}

main().catch((e) => { console.error(e); process.exit(1); });
