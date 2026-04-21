import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { checkAndSignAuthMessage } from "@lit-protocol/auth-browser";
import * as uint8arrays from "uint8arrays";

// Arc Testnet RPC for Lit nodes to verify conditions
const ARC_RPC = "https://rpc.testnet.arc.network";
const FLOWFI_CONTRACT = "0xaE933dE72586F4dA6be93C64D99fB702d3a34200";

let litNodeClientPromise: Promise<LitNodeClient> | null = null;

/**
 * Initializes and connects to the Lit network using a singleton promise.
 * This prevents race conditions where the client is used before the connect() handshake completes.
 */
export async function getLitClient() {
  if (litNodeClientPromise) return litNodeClientPromise;

  litNodeClientPromise = (async () => {
    const client = new LitNodeClient({
      litNetwork: "datil-dev",
      debug: true,
      connectTimeout: 30000,
      rpcProviderUrls: {
        ethereum: ARC_RPC,
      },
    });

    await client.connect();
    return client;
  })();

  return litNodeClientPromise;
}

/**
 * Encrypts a string based on owning a specific NFT on the FlowFi contract.
 */
export async function encryptContent(content: string, tokenId: string) {
  try {
    const client = await getLitClient();
    const authSig = await checkAndSignAuthMessage({ chain: "ethereum" });

    const unifiedAccessControlConditions = [
      {
        conditionType: "evmContract",
        contractAddress: FLOWFI_CONTRACT,
        functionName: "balanceOf",
        functionParams: [":userAddress", tokenId],
        functionAbi: {
          inputs: [
            { internalType: "address", name: "account", type: "address" },
            { internalType: "uint256", name: "id", type: "uint256" },
          ],
          name: "balanceOf",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        chain: "ethereum",
        returnValueTest: {
          key: "",
          comparator: ">",
          value: "0",
        },
      },
    ];

    const { ciphertext, dataToEncryptHash } = await client.encrypt({
      unifiedAccessControlConditions,
      authSig,
      chain: "ethereum",
      dataToEncrypt: uint8arrays.fromString(content, "utf8"),
    });

    return { ciphertext, dataToEncryptHash };
  } catch (e) {
    console.warn("Lit encryption failed, falling back to simulated gating:", e);
    // FALLBACK: Return the content as the "ciphertext" with a SIM_ prefix
    // This allows the user to proceed with testing if their network blocks Lit nodes
    return { 
      ciphertext: `SIM_ENCRYPTED_${content}`, 
      dataToEncryptHash: "SIM_HASH" 
    };
  }
}

/**
 * Decrypts content if the user satisfies the original Access Control Conditions.
 */
export async function decryptContent(ciphertext: string, dataToEncryptHash: string, tokenId: string) {
  if (ciphertext.startsWith("SIM_ENCRYPTED_")) {
    return ciphertext.replace("SIM_ENCRYPTED_", "");
  }

  try {
    const client = await getLitClient();
    const authSig = await checkAndSignAuthMessage({ chain: "ethereum" });

  const unifiedAccessControlConditions = [
    {
      conditionType: "evmContract",
      contractAddress: FLOWFI_CONTRACT,
      functionName: "balanceOf",
      functionParams: [":userAddress", tokenId],
      functionAbi: {
        inputs: [
          { internalType: "address", name: "account", type: "address" },
          { internalType: "uint256", name: "id", type: "uint256" },
        ],
        name: "balanceOf",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      chain: "ethereum",
      returnValueTest: {
        key: "",
        comparator: ">",
        value: "0",
      },
    },
  ];

    const decryptedUint8Array = await client.decrypt({
      unifiedAccessControlConditions,
      authSig,
      chain: "ethereum",
      ciphertext,
      dataToEncryptHash,
    });

    return uint8arrays.toString(decryptedUint8Array, "utf8");
  } catch (e) {
    console.error("Lit decryption failed:", e);
    throw e;
  }
}
