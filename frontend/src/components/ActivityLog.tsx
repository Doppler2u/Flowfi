"use client";

import { useWeb3 } from "@/context/Web3Provider";
import { ExternalLink, Clock, AlertCircle, Info } from "lucide-react";
import InfoTooltip from "./InfoTooltip";

export default function ActivityLog() {
  const { logs } = useWeb3();

  return (
    <div className="brut-card flex flex-col flex-1 min-h-[380px]">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-main)] pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-6 bg-[var(--text-main)]" />
          <div className="flex items-center gap-1.5 flex-1">
            <h2 className="brut-title text-[var(--text-main)]">Activity Log</h2>
            <InfoTooltip 
              title="Event Auditing"
              content="A REAL-TIME RECORD OF ALL ON-CHAIN INTERACTIONS. CAPTURES DEPOSITS, WITHDRAWALS, SERVICE USAGE, AND CONTENT UNLOCKS WITH DIRECT LINKS TO ARCSCAN FOR VERIFICATION."
            />
          </div>
        </div>
        <div className="text-[10px] font-mono text-[var(--text-dim)] uppercase font-bold tracking-widest">
          {logs.length} Events
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-3 font-mono max-h-[340px]">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20">
            <Clock size={32} className="mb-2" />
            <p className="text-[10px] uppercase font-black tracking-widest">Listening for events...</p>
          </div>
        ) : (
          logs.map((log, index) => {
            const isError = log.type === "error";
            const colorClass = isError ? "text-[#FF3B3B] border-[#FF3B3B]/30" : "text-[var(--text-dim)] border-[var(--border-main)]";
            const iconColor = isError ? "text-[#FF3B3B]" : "text-[var(--text-dim)]";

            return (
              <div
                key={index}
                className={`border-2 p-3 bg-[var(--bg-page)] transition-colors hover:border-[#444] ${colorClass}`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex items-center gap-2">
                    {isError ? <AlertCircle size={10} className={iconColor} /> : <Info size={10} className={iconColor} />}
                    <span className={`text-[9px] uppercase font-black tracking-widest ${isError ? "text-[#FF3B3B]" : "text-[var(--text-main)]"}`}>
                      {log.type}
                    </span>
                  </div>
                  <span className="text-[8px] text-[var(--text-dim)] font-bold">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                
                <p className="text-[10px] leading-relaxed break-words text-[var(--text-main)]">
                  {log.message}
                </p>

                { (log.explorerUrl || log.txHash) && (
                  <a
                    href={log.explorerUrl || `https://testnet.arcscan.app/tx/${log.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 border border-[var(--border-main)] hover:border-[#FFE600] hover:text-[#FFE600] transition-all text-[8px] uppercase font-black"
                  >
                    View Transaction <ExternalLink size={8} />
                  </a>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
