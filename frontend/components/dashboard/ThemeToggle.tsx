"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Palette } from "lucide-react";

type Theme = "dark" | "coloured" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("fitflow-theme") as Theme;
    if (savedTheme === "dark" || savedTheme === "coloured" || savedTheme === "light") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      // Default to dark mode
      document.documentElement.setAttribute("data-theme", "dark");
    }
    setMounted(true);
  }, []);

  const changeTheme = (newTheme: Theme) => {
    // Inject a style block to disable all transitions temporarily during the theme switch
    const css = document.createElement("style");
    css.type = "text/css";
    css.appendChild(
      document.createTextNode(
        `* {
           -webkit-transition: none !important;
           -moz-transition: none !important;
           -o-transition: none !important;
           -ms-transition: none !important;
           transition: none !important;
         }`
      )
    );
    document.head.appendChild(css);

    // Apply the new theme
    setTheme(newTheme);
    localStorage.setItem("fitflow-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);

    // Force a reflow, flushing the CSS changes
    const _ = window.getComputedStyle(css).opacity;

    // Remove the style block after the repaint to restore normal hover transitions
    setTimeout(() => {
      document.head.removeChild(css);
    }, 20);
  };

  // Prevent hydration mismatch layout shifts
  if (!mounted) {
    return (
      <div className="w-28 h-9 bg-zinc-900 border border-zinc-850 rounded-xl animate-pulse" />
    );
  }

  return (
    <div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-850 p-1 rounded-xl z-20">
      {/* Dark Button */}
      <button
        onClick={() => changeTheme("dark")}
        title="Dark Theme"
        className={`p-1.5 rounded-lg transition-all ${
          theme === "dark"
            ? "bg-zinc-800 text-white shadow-sm"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <Moon className="w-3.5 h-3.5" />
      </button>

      {/* Coloured Button */}
      <button
        onClick={() => changeTheme("coloured")}
        title="Coloured Theme"
        className={`p-1.5 rounded-lg transition-all ${
          theme === "coloured"
            ? "bg-zinc-800 text-sky-400 shadow-sm"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <Palette className="w-3.5 h-3.5" />
      </button>

      {/* Light Button */}
      <button
        onClick={() => changeTheme("light")}
        title="Light Theme"
        className={`p-1.5 rounded-lg transition-all ${
          theme === "light"
            ? "bg-zinc-800 text-amber-500 shadow-sm"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <Sun className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
