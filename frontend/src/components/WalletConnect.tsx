"use client";

import { useWeb3 } from "@/context/Web3Provider";
import { Wallet, LogOut, AlertTriangle, RefreshCw, Loader2, PlusCircle } from "lucide-react";

export default function WalletConnect() {
  const {
    address,
    isConnected,
    isCorrectNetwork,
    contractBalance,
    walletBalance,
    isLoading,
    connect,
    disconnect,
    switchNetwork,
    refreshBalance,
  } = useWeb3();

  if (!isConnected) {
    return (
      <button
        id="connect-wallet-btn"
        onClick={connect}
        disabled={isLoading}
        className="brut-btn brut-btn-yellow"
      >
        {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
        {isLoading ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end font-mono">

      {/* Wrong network banner — clickable to switch/add */}
      {!isCorrectNetwork && (
        <button
          id="switch-network-btn"
          onClick={switchNetwork}
          className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-amber-500 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase hover:bg-amber-500 hover:text-black transition-all"
          title="Click to add/switch to Arc Testnet"
        >
          <AlertTriangle size={12} />
          Switch to ARC
          <PlusCircle size={10} />
        </button>
      )}

      {/* Wallet native balance */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border-2 border-[#222] bg-black text-[10px] uppercase font-black">
        <span className="text-[#555]">Wallet</span>
        <span className="text-white">
          {parseFloat(walletBalance).toFixed(3)} USDC
        </span>
      </div>

      {/* FlowFi contract balance */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border-2 border-[#222] bg-black text-[10px] uppercase font-black">
        <span className="text-[#4D7FFF]">FlowFi</span>
        <span className="text-white">
          {parseFloat(contractBalance).toFixed(3)} USDC
        </span>
      </div>

      {/* Address pill */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-2 border-[#222] bg-black">
        <div className={`w-2 h-2 ${isCorrectNetwork ? "bg-[#00FF87]" : "bg-amber-500"}`} />
        <span className="text-white text-[10px] font-black uppercase">
          {address?.slice(0, 4)}...{address?.slice(-4)}
        </span>
      </div>

      {/* Refresh */}
      <button
        id="refresh-balance-btn"
        onClick={refreshBalance}
        title="Refresh balance"
        className="p-1.5 border-2 border-[#222] bg-black text-[#555] hover:text-[#FFE600] hover:border-[#FFE600] transition-all"
      >
        <RefreshCw size={14} />
      </button>

      {/* Disconnect */}
      <button
        id="disconnect-wallet-btn"
        onClick={disconnect}
        title="Disconnect wallet"
        className="p-1.5 border-2 border-[#FF3B3B] bg-black text-[#FF3B3B] hover:bg-[#FF3B3B] hover:text-black transition-all"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
