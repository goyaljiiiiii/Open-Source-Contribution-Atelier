import React, { useState } from "react";
import { Sparkles, Dices, Copy, Check, Smile, Flame } from "lucide-react";
import { toast } from "react-hot-toast";

interface VibeOption {
  id: string;
  label: string;
  emoji: string;
  color: string;
  textColor: string;
  quote: string;
}

const VIBE_OPTIONS: VibeOption[] = [
  {
    id: "bughunter",
    label: "Bug Hunter",
    emoji: "🐛",
    color: "bg-[#FF6B6B]",
    textColor: "text-white",
    quote: "Squashing bugs before they hit production!",
  },
  {
    id: "shipped",
    label: "Shipped it!",
    emoji: "🚀",
    color: "bg-[#6BCB77]",
    textColor: "text-black",
    quote: "Merged PR #100 with 0 test failures!",
  },
  {
    id: "coffee",
    label: "Coffee Powered",
    emoji: "☕",
    color: "bg-[#FFD93D]",
    textColor: "text-black",
    quote: "Converting caffeine into clean TypeScript code.",
  },
  {
    id: "wizard",
    label: "Git Wizard",
    emoji: "🧙‍♂️",
    color: "bg-[#4D96FF]",
    textColor: "text-white",
    quote: "Master of interactive rebase & cherry-picking.",
  },
];

const FUNNY_COMMITS = [
  'git commit -m "fixed bug by creating 3 smaller bugs 🐛"',
  'git commit -m "rebased 42 times and survived ⚔️"',
  'git commit -m "added comments so future me doesn\'t cry 😭"',
  'git commit -m "force push and close eyes 🙈"',
  'git commit -m "powered by 90% caffeine and 10% stackoverflow ☕"',
  'git commit -m "LGTM! (I didn\'t read the diff) 🤫"',
  'git commit -m "it works on my machine 💻"',
  'git commit -m "refactored everything, breaks nothing (hopefully) 🤞"',
];

interface PlayfulGitVibeWidgetProps {
  onStampSticker?: (label: string, color: string, textColor: string) => void;
}

export function PlayfulGitVibeWidget({ onStampSticker }: PlayfulGitVibeWidgetProps) {
  const [activeVibe, setActiveVibe] = useState<VibeOption>(VIBE_OPTIONS[0]);
  const [commitIdx, setCommitIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number; y: number }[]>([]);

  const handleVibeChange = (vibe: VibeOption, e: React.MouseEvent) => {
    setActiveVibe(vibe);
    
    // Spawn playful burst
    const rect = e.currentTarget.getBoundingClientRect();
    const newBursts = Array.from({ length: 5 }).map((_, i) => ({
      id: Date.now() + i,
      emoji: vibe.emoji,
      x: rect.left + rect.width / 2 + (Math.random() * 80 - 40),
      y: rect.top - 20 - (Math.random() * 40),
    }));
    setBursts((prev) => [...prev, ...newBursts]);
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => !newBursts.some((nb) => nb.id === b.id)));
    }, 900);

    if (onStampSticker) {
      onStampSticker(`${vibe.label} ${vibe.emoji}`, vibe.color, vibe.textColor);
    }
  };

  const handleRollCommit = () => {
    const nextIdx = (commitIdx + 1) % FUNNY_COMMITS.length;
    setCommitIdx(nextIdx);
    setCopied(false);
  };

  const handleCopyCommit = () => {
    void navigator.clipboard.writeText(FUNNY_COMMITS[commitIdx]);
    setCopied(true);
    toast.success("Commit message copied! 📋", {
      style: {
        border: "3px solid black",
        fontWeight: "bold",
        borderRadius: "12px",
      },
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-white dark:bg-[#151411] border-4 border-black dark:border-[#4a4238] rounded-3xl p-5 shadow-card relative overflow-hidden transition-all">
      {/* Floating Emoji Bursts */}
      {bursts.map((b) => (
        <div
          key={b.id}
          className="fixed text-2xl select-none pointer-events-none animate-bounce z-50 transition-all"
          style={{ left: b.x, top: b.y }}
        >
          {b.emoji}
        </div>
      ))}

      {/* Widget Header */}
      <div className="flex items-center justify-between mb-3 border-b-2 border-black/10 dark:border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-amber-300 border-2 border-black text-black">
            <Sparkles size={16} className="animate-spin" />
          </span>
          <span className="font-black text-xs uppercase tracking-wider text-black dark:text-[#f0ebe2]">
            Playful Dev Playground
          </span>
        </div>
        <span className="text-[10px] font-black bg-black text-white dark:bg-white dark:text-black px-2.5 py-0.5 rounded-full uppercase">
          Interactive
        </span>
      </div>

      {/* Mood Selector Buttons */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-[11px] font-bold text-muted dark:text-[#9b8f80]">
          <span>Select Your Dev Vibe:</span>
          <span className="text-[10px] text-black dark:text-white font-black">Click to Stamp Badge 🎨</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {VIBE_OPTIONS.map((vibe) => {
            const isActive = activeVibe.id === vibe.id;
            return (
              <button
                key={vibe.id}
                type="button"
                onClick={(e) => handleVibeChange(vibe, e)}
                className={`py-2 px-2.5 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? `${vibe.color} ${vibe.textColor} border-black shadow-card-sm -translate-y-0.5`
                    : "bg-surface-low dark:bg-[#1f1c18] border-black/20 dark:border-white/20 text-black dark:text-white hover:border-black hover:-translate-y-0.5"
                }`}
              >
                <span>{vibe.emoji}</span>
                <span className="truncate">{vibe.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Vibe Status Banner */}
      <div className={`p-3 rounded-2xl border-2 border-black ${activeVibe.color} ${activeVibe.textColor} shadow-card-sm mb-4 flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{activeVibe.emoji}</span>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider opacity-80">Current Dev Mood</div>
            <div className="text-xs font-black">{activeVibe.quote}</div>
          </div>
        </div>
        <Flame className="w-5 h-5 flex-shrink-0 animate-pulse" />
      </div>

      {/* Funny Git Commit Generator */}
      <div className="bg-surface-lowest dark:bg-[#0f0e0c] rounded-2xl border-2 border-black dark:border-[#4a4238] p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-muted dark:text-[#9b8f80]">
          <span className="flex items-center gap-1">
            <Smile size={14} className="text-amber-500" />
            Random Git Commit Generator
          </span>
          <button
            type="button"
            onClick={handleRollCommit}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-300 text-black border-2 border-black text-[10px] font-black hover:-translate-y-0.5 active:translate-y-0 shadow-card-sm cursor-pointer"
          >
            <Dices size={12} /> Roll 🎲
          </button>
        </div>

        <div className="font-mono text-xs p-2.5 bg-[#0F172A] text-[#38BDF8] rounded-xl border border-black flex items-center justify-between gap-2 overflow-x-auto">
          <span className="truncate font-bold">{FUNNY_COMMITS[commitIdx]}</span>
          <button
            type="button"
            onClick={handleCopyCommit}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md border border-white/20 transition-all flex-shrink-0 cursor-pointer"
            title="Copy commit"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlayfulGitVibeWidget;
