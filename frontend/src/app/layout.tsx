import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/context/Web3Provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "FlowFi — Programmable Payment Hub",
  description: "Pay-to-access content, usage-based credits, and advanced payment routing on Arc Testnet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-[#080b12] text-slate-100 antialiased`}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
