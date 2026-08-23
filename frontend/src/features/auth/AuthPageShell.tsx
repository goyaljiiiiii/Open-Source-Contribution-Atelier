import React from "react";
import { Sun, Moon, Code2, GitBranch, ShieldCheck, Sparkles } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { Link } from "react-router-dom";

type AuthPageShellProps = {
  title: string;
  subtitle: string;
  mode: "login" | "signup" | "info";
  children: React.ReactNode;
};

export function AuthPageShell({
  title,
  subtitle,
  mode,
  children,
}: AuthPageShellProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen w-full bg-[#FAF9F6] text-slate-900 dark:bg-[#12100e] dark:text-[#f0ebe2] transition-colors duration-300 relative overflow-x-hidden flex flex-col justify-between">
      {/* Background Decorative Ambient Shapes & Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20 bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px] z-0" />

      {/* Floating Subtle Playful Background Blobs */}
      <div className="absolute top-12 left-10 w-64 h-64 bg-[#C3C0FF]/30 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#FFD93D]/25 rounded-full blur-3xl pointer-events-none z-0" />

      {/* Top Header / Branding Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between relative z-20">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl border-3 border-black bg-[#C3C0FF] dark:bg-[#6BCB77] flex items-center justify-center font-black text-black text-lg shadow-card-sm group-hover:rotate-6 group-hover:scale-105 transition-all">
            🚀
          </div>
          <div>
            <span className="font-black text-xl tracking-tight text-black dark:text-white uppercase drop-shadow-[1px_1px_0px_#000] dark:drop-shadow-none">
              Atelier
            </span>
            <span className="ml-2 text-[10px] font-black uppercase tracking-widest bg-black text-white dark:bg-white dark:text-black px-2 py-0.5 rounded-full">
              Open Source
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-2 rounded-xl bg-white dark:bg-[#1f1c18] px-3.5 py-2 text-xs font-black text-slate-700 hover:text-black dark:text-slate-300 dark:hover:text-white border-2 border-black dark:border-[#3a342c] shadow-card-sm hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all cursor-pointer"
            onClick={toggleTheme}
            aria-label={
              theme === "light" ? "Switch to dark mode" : "Switch to light mode"
            }
          >
            {theme === "light" ? (
              <>
                <Moon size={16} /> <span>Dark</span>
              </>
            ) : (
              <>
                <Sun size={16} /> <span>Light</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 lg:py-8 flex-1 flex items-center justify-center relative z-10">
        <div className="w-full flex flex-col lg:flex-row gap-10 lg:gap-14 items-center justify-center">

          {/* LEFT SIDE: Brand Features & Community Spotlight */}
          <div className="flex-1 flex flex-col justify-center order-2 lg:order-1 max-w-xl">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="font-black text-xs uppercase tracking-widest bg-[#FFD93D] border-2 border-black text-black px-4 py-1.5 rounded-full shadow-card-sm flex items-center gap-1.5">
                <Sparkles size={14} /> {mode} PORTAL
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-4 leading-[1.15] dark:text-white">
              Master Open Source <span className="bg-[#C3C0FF] dark:bg-[#4D96FF]/40 px-2 py-0.5 rounded-lg border-2 border-black dark:border-white/20 inline-block rotate-[-1deg]">By Doing</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 font-bold leading-relaxed mb-8 dark:text-slate-300">
              {subtitle}
            </p>

            {/* Interactive Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border-3 border-black bg-white p-5 shadow-card hover:-translate-y-1 transition-all dark:bg-[#1f1c18] dark:border-[#3a342c]">
                <div className="w-9 h-9 rounded-xl bg-[#4D96FF]/20 border-2 border-black flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
                  <Code2 size={20} />
                </div>
                <h3 className="font-black text-black dark:text-white text-sm mb-1">
                  Git Sandboxes 💻
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                  Practice Git workflows, branches, and merges safely in interactive browser sandboxes.
                </p>
              </div>

              <div className="rounded-2xl border-3 border-black bg-white p-5 shadow-card hover:-translate-y-1 transition-all dark:bg-[#1f1c18] dark:border-[#3a342c]">
                <div className="w-9 h-9 rounded-xl bg-[#6BCB77]/20 border-2 border-black flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                  <GitBranch size={20} />
                </div>
                <h3 className="font-black text-black dark:text-white text-sm mb-1">
                  Peer Reviews 🤝
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                  Submit pull requests, review real code, and level up with maintainer feedback.
                </p>
              </div>
            </div>

            {/* Micro Trust Banner */}
            <div className="mt-6 flex items-center gap-3 bg-white/80 dark:bg-[#1f1c18]/80 p-3 rounded-xl border-2 border-black/10 dark:border-white/10 text-xs font-bold text-slate-500 dark:text-slate-400">
              <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
              <span>Zero-friction setup. Start practicing real open source contributions in seconds.</span>
            </div>
          </div>

          {/* RIGHT SIDE: Redesigned Auth Card Form Container */}
          <div className="flex-1 w-full max-w-md order-1 lg:order-2">
            <div className="w-full rounded-[28px] border-4 border-black bg-white p-7 sm:p-9 shadow-card relative dark:bg-[#1c1917] dark:border-[#3a342c] transition-all">
              {children}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs font-bold text-slate-400 dark:text-slate-500 relative z-20">
        © {new Date().getFullYear()} Open Source Contribution Atelier • Built for developers
      </footer>
    </div>
  );
}
