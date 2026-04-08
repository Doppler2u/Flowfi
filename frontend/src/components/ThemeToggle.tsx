"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      // Respect system preference if no saved theme
      setTheme("light");
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  if (!mounted) return <div className="w-10 h-10 border-2 border-[#2a2a2a]" />;

  return (
    <button
      onClick={toggleTheme}
      className="w-10 h-10 flex items-center justify-center border-2 border-main bg-card text-main transition-all hover:bg-[#FFE600] hover:text-black hover:border-[#FFE600]"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun size={18} strokeWidth={2.5} />
      ) : (
        <Moon size={18} strokeWidth={2.5} />
      )}
    </button>
  );
}
