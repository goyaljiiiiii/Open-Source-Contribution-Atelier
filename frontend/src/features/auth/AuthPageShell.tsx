import React from "react";
import {
  Sun,
  Moon,
  Code2,
  GitBranch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { Link } from "react-router-dom";

type AuthPageShellProps = {
  title: string;
  subtitle: string;
  mode: "login" | "signup" | "info";
  children: React.ReactNode;
};

export function AuthPageShell({
  subtitle,
  mode,
  children,
}: AuthPageShellProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="h-screen max-h-screen w-full bg-[#FAF9F6] text-slate-900 dark:bg-[#12100e] dark:text-[#f0ebe2] transition-colors duration-300 relative overflow-hidden flex flex-col justify-between">
      {/* Background Decorative Ambient Shapes & Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-20 bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px] z-0" />

      {/* Floating Subtle Playful Background Blobs */}
      <div className="absolute top-6 left-10 w-48 h-48 bg-[#C3C0FF]/30 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-6 right-10 w-64 h-64 bg-[#FFD93D]/20 rounded-full blur-3xl pointer-events-none z-0" />

      {/* Top Header / Branding Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between relative z-20 shrink-0">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl border-2 border-black bg-[#C3C0FF] dark:bg-[#6BCB77] flex items-center justify-center font-black text-black text-base shadow-card-sm group-hover:rotate-6 group-hover:scale-105 transition-all">
            🚀
          </div>
          <div className="flex items-center gap-2">
            <span className="font-black text-lg tracking-tight text-black dark:text-white uppercase drop-shadow-[1px_1px_0px_#000] dark:drop-shadow-none">
              Atelier
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest bg-black text-white dark:bg-white dark:text-black px-2 py-0.5 rounded-full hidden sm:inline-block">
              Open Source
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-[#1f1c18] px-3 py-1.5 text-xs font-black text-slate-700 hover:text-black dark:text-slate-300 dark:hover:text-white border-2 border-black dark:border-[#3a342c] shadow-card-sm hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all cursor-pointer"
            onClick={toggleTheme}
            aria-label={
              theme === "light" ? "Switch to dark mode" : "Switch to light mode"
            }
          >
            {theme === "light" ? (
              <>
                <Moon size={14} /> <span>Dark</span>
              </>
            ) : (
              <>
                <Sun size={14} /> <span>Light</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area: Centered and strictly non-scrollable */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-2 flex-1 flex items-center justify-center relative z-10 min-h-0 overflow-hidden">
        <div className="w-full flex flex-col lg:flex-row gap-6 lg:gap-12 items-center justify-center max-h-full">
          {/* LEFT SIDE: Brand Features & Community Spotlight */}
          <div className="flex-1 hidden lg:flex flex-col justify-center max-w-lg">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="font-black text-[10px] uppercase tracking-widest bg-[#FFD93D] border-2 border-black text-black px-3 py-1 rounded-full shadow-card-sm flex items-center gap-1">
                <Sparkles size={12} /> {mode} PORTAL
              </span>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 mb-3 leading-[1.15] dark:text-white">
              Master Open Source{" "}
              <span className="bg-[#C3C0FF] dark:bg-[#4D96FF]/40 px-2 py-0.5 rounded-lg border-2 border-black dark:border-white/20 inline-block rotate-[-1deg]">
                By Doing
              </span>
            </h1>

            <p className="text-sm text-slate-600 font-bold leading-relaxed mb-5 dark:text-slate-300">
              {subtitle}
            </p>

            {/* Compact Feature Cards Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border-2 border-black bg-white p-3.5 shadow-card hover:-translate-y-0.5 transition-all dark:bg-[#1f1c18] dark:border-[#3a342c]">
                <div className="w-8 h-8 rounded-lg bg-[#4D96FF]/20 border-2 border-black flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2">
                  <Code2 size={16} />
                </div>
                <h3 className="font-black text-black dark:text-white text-xs mb-0.5">
                  Git Sandboxes 💻
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] font-semibold leading-snug">
                  Practice Git workflows and merges safely in interactive
                  sandboxes.
                </p>
              </div>

              <div className="rounded-xl border-2 border-black bg-white p-3.5 shadow-card hover:-translate-y-0.5 transition-all dark:bg-[#1f1c18] dark:border-[#3a342c]">
                <div className="w-8 h-8 rounded-lg bg-[#6BCB77]/20 border-2 border-black flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                  <GitBranch size={16} />
                </div>
                <h3 className="font-black text-black dark:text-white text-xs mb-0.5">
                  Peer Reviews 🤝
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] font-semibold leading-snug">
                  Review real pull requests and level up with maintainer
                  feedback.
                </p>
              </div>
            </div>

            {/* Micro Trust Banner */}
            <div className="mt-4 flex items-center gap-2 bg-white/80 dark:bg-[#1f1c18]/80 p-2.5 rounded-xl border-2 border-black/10 dark:border-white/10 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
              <span>
                Zero-friction setup. Start practicing real open source
                contributions.
              </span>
            </div>
          </div>

          {/* RIGHT SIDE: Compact Auth Form Container */}
          <div className="w-full max-w-md shrink-0">
            <div className="w-full rounded-[24px] border-3 border-black bg-white p-5 sm:p-6 shadow-card relative dark:bg-[#1c1917] dark:border-[#3a342c] transition-all">
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-2.5 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 relative z-20 shrink-0">
        © {new Date().getFullYear()} Open Source Contribution Atelier • Built
        for developers
      </footer>
    </div>
  );
}
