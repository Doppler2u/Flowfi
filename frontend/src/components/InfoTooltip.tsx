"use client";

import { useState, useRef, useEffect } from "react";
import { Info, X } from "lucide-react";

interface InfoTooltipProps {
  content: string | React.ReactNode;
  title?: string;
}

export default function InfoTooltip({ content, title }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More info"
        className={`p-1 border-2 transition-all ${
          open
            ? "text-black bg-[#FFE600] border-[#FFE600]"
            : "text-[#555] border-[#222] hover:text-[#FFE600] hover:border-[#FFE600]"
        }`}
      >
        <Info size={11} />
      </button>

      {open && (
        <>
          {/* Mobile Overlay Backdrop */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] sm:hidden" onClick={() => setOpen(false)} />
          
          <div
            className="fixed inset-x-4 top-[15%] sm:absolute sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-full sm:mt-4 z-[100] w-auto sm:w-72 bg-[var(--bg-card)] border-4 border-[#FFE600] p-4 text-[11px] font-mono shadow-none"
            style={{ animation: "popIn 0.1s ease-out" }}
          >
            {/* Brutalism Arrow - Hidden on mobile for safety */}
            <div className="hidden sm:block absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#FFE600] [clip-path:polygon(50%_0%,_0%_100%,_100%_100%)] rotate-180" />

            <div className="relative">
              <div className="flex justify-between items-start mb-3 border-b-2 border-[#FFE600]/20 pb-2">
                {title ? (
                  <p className="font-black text-[#A39200] dark:text-[#FFE600] uppercase tracking-widest">{title}</p>
                ) : (
                  <p className="font-black text-[#A39200] dark:text-[#FFE600] uppercase tracking-widest">Documentation</p>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-[var(--text-dim)] hover:text-[#FFE600] transition-colors p-1"
                >
                  <X size={14} />
                </button>
              </div>
              
              <div className="text-[var(--text-main)] leading-relaxed uppercase whitespace-normal break-words max-h-[60vh] overflow-y-auto">
                {content}
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: var(--tw-translate-x) scale(0.95); }
          to   { opacity: 1; transform: var(--tw-translate-x) scale(1); }
        }
        @media (max-width: 640px) {
          @keyframes popIn {
            from { opacity: 0; transform: scale(0.95); }
            to   { opacity: 1; transform: scale(1); }
          }
        }
      `}</style>
    </div>
  );
}
