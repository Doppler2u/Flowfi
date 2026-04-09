"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createPublicClient, createWalletClient, custom, http, formatUnits, parseUnits, PublicClient, WalletClient } from "viem";
import { FlowFiABI, CONTRACT_ADDRESS } from "@/lib/abi";

export const ARC_TESTNET = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
};

export type LogEntry = {
  id: string;
  type: "deposit" | "withdraw" | "unlock" | "service" | "create" | "route" | "error" | "info";
  message: string;
  timestamp: Date;
  txHash?: string;
  explorerUrl?: string;
};

type Web3ContextType = {
  address: `0x${string}` | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  contractBalance: string;
  walletBalance: string;
  isLoading: boolean;
  logs: LogEntry[];
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  publicClient: ReturnType<typeof createPublicClient> | null;
  walletClient: ReturnType<typeof createWalletClient> | null;
};

const Web3Context = createContext<Web3ContextType | null>(null);

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used inside Web3Provider");
  return ctx;
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [contractBalance, setContractBalance] = useState("0");
  const [walletBalance, setWalletBalance] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  const addLog = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    setLogs((prev) => [
      { ...entry, id: Math.random().toString(36).slice(2), timestamp: new Date() },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const setupClients = useCallback(async (addr: `0x${string}`) => {
    const pub = createPublicClient({ chain: ARC_TESTNET as any, transport: http() });
    const wallet = createWalletClient({ account: addr, chain: ARC_TESTNET as any, transport: custom(window.ethereum!) });
    setPublicClient(pub as any);
    setWalletClient(wallet as any);
    return { pub, wallet };
  }, []);

  const fetchBalances = useCallback(async (addr: `0x${string}`, pub: any) => {
    try {
      const [contractBal, nativeBal] = await Promise.all([
        pub.readContract({ address: CONTRACT_ADDRESS, abi: FlowFiABI, functionName: "balances", args: [addr] }) as Promise<bigint>,
        pub.getBalance({ address: addr }),
      ]);
      // Arc native USDC = 18 decimals at the EVM level (same as wei)
      setContractBalance(formatUnits(contractBal, 18));
      setWalletBalance(formatUnits(nativeBal, 18));
    } catch (e) {
      console.error("Balance fetch error", e);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!address || !publicClient) return;
    await fetchBalances(address, publicClient);
  }, [address, publicClient, fetchBalances]);

  const checkNetwork = useCallback(async () => {
    if (!window.ethereum) return false;
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    const correct = parseInt(chainId, 16) === ARC_TESTNET.id;
    setIsCorrectNetwork(correct);
    return correct;
  }, []);

  // Arc Testnet chain params — 5042002 decimal = 0x4CEF52 hex
  const ARC_CHAIN_PARAMS = {
    chainId: "0x4CEF52",
    chainName: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: ["https://rpc.testnet.arc.network"],
    blockExplorerUrls: ["https://testnet.arcscan.app"],
  };

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      // First try switching — works if the chain is already in the wallet
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x4CEF52" }],
      });
      await checkNetwork();
      addLog({ type: "info", message: "Switched to Arc Testnet ✓" });
    } catch (switchError: any) {
      // Error 4902 = chain not added yet → add it
      if (switchError.code === 4902 || switchError.code === -32603) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [ARC_CHAIN_PARAMS],
          });
          await checkNetwork();
          addLog({ type: "info", message: "Arc Testnet added & switched ✓" });
        } catch (addError: any) {
          addLog({ type: "error", message: `Failed to add network: ${addError.message}` });
        }
      } else {
        addLog({ type: "error", message: `Switch failed: ${switchError.message}` });
      }
    }
  }, [addLog, checkNetwork]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      addLog({ type: "error", message: "No wallet detected. Please install MetaMask." });
      return;
    }
    setIsLoading(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const addr = accounts[0] as `0x${string}`;
      setAddress(addr);

      // Auto-switch / add Arc Testnet silently on connect
      const correct = await checkNetwork();
      if (!correct) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x4CEF52" }],
          });
        } catch (switchErr: any) {
          if (switchErr.code === 4902 || switchErr.code === -32603) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [ARC_CHAIN_PARAMS],
            });
          }
        }
        await checkNetwork();
      }

      const { pub } = await setupClients(addr);
      await fetchBalances(addr, pub);
      addLog({ type: "info", message: `Wallet connected: ${addr.slice(0, 6)}...${addr.slice(-4)}` });
    } catch (e: any) {
      if (e.code !== 4001) { // ignore user-rejected
        addLog({ type: "error", message: e.message || "Connection failed" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [addLog, checkNetwork, setupClients, fetchBalances, switchNetwork]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setPublicClient(null);
    setWalletClient(null);
    setContractBalance("0");
    setWalletBalance("0");
    addLog({ type: "info", message: "Wallet disconnected" });
  }, [addLog]);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnect();
      else {
        const addr = accounts[0] as `0x${string}`;
        setAddress(addr);
        setupClients(addr).then(({ pub }) => fetchBalances(addr, pub));
      }
    };
    const handleChainChanged = () => checkNetwork();
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnect, setupClients, fetchBalances, checkNetwork]);

  return (
    <Web3Context.Provider
      value={{
        address,
        isConnected: !!address,
        isCorrectNetwork,
        contractBalance,
        walletBalance,
        isLoading,
        logs,
        connect,
        disconnect,
        switchNetwork,
        refreshBalance,
        addLog,
        publicClient,
        walletClient,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}
