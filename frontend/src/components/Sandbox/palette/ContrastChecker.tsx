import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { evaluateContrast, type ContrastResult } from "./colorUtils";

interface ContrastCheckerProps {
  foreground: string;
  background: string;
  onSwap: () => void;
}

function Badge({ label, pass }: { label: string; pass: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full border ${
        pass
          ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
          : "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
      }`}
    >
      {pass ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

function RatioMeter({ ratio }: { ratio: number }) {
  const percentage = Math.min((ratio / 21) * 100, 100);
  const color =
    ratio >= 7
      ? "bg-green-500"
      : ratio >= 4.5
        ? "bg-yellow-500"
        : ratio >= 3
          ? "bg-orange-500"
          : "bg-red-500";

  return (
    <div className="mt-3">
      <div className="h-3 bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-muted dark:text-[#9b8f80]">0:1</span>
        <span className="text-[9px] font-mono text-muted dark:text-[#9b8f80]">21:1</span>
      </div>
    </div>
  );
}

export function ContrastChecker({
  foreground,
  background,
  onSwap,
}: ContrastCheckerProps) {
  const [result, setResult] = useState<ContrastResult | null>(null);

  useEffect(() => {
    setResult(evaluateContrast(foreground, background));
  }, [foreground, background]);

  if (!result) return null;

  return (
    <div className="bg-surface-low dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl overflow-hidden shadow-card">
      <div className="px-4 py-3 border-b-4 border-black dark:border-[#2e2924]">
        <span className="font-black text-xs uppercase tracking-wider text-text dark:text-[#f0ebe2]">
          WCAG Contrast Checker
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Preview */}
        <div
          className="rounded-xl border-2 border-black/10 dark:border-[#2e2924] p-6 text-center"
          style={{ backgroundColor: background }}
        >
          <p className="text-xl font-black" style={{ color: foreground }}>
            The quick brown fox
          </p>
          <p className="text-sm font-bold mt-1" style={{ color: foreground }}>
            jumps over the lazy dog
          </p>
        </div>

        {/* Ratio display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`text-3xl font-black ${
                result.ratio >= 7
                  ? "text-green-600 dark:text-green-400"
                  : result.ratio >= 4.5
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
              }`}
            >
              {result.ratio}:1
            </span>
            {result.ratio >= 7 ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : result.ratio >= 4.5 ? (
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
          <button
            onClick={onSwap}
            className="px-3 py-1.5 text-[10px] font-black uppercase bg-primary text-black border-2 border-black rounded-lg hover:-translate-y-0.5 transition-all"
          >
            Swap Colors
          </button>
        </div>

        <RatioMeter ratio={result.ratio} />

        {/* WCAG Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge label="AA Normal Text" pass={result.wcagAA} />
          <Badge label="AA Large Text" pass={result.wcagAALarge} />
          <Badge label="AAA Normal Text" pass={result.wcagAAA} />
          <Badge label="AAA Large Text" pass={result.wcagAAALarge} />
        </div>

        {/* Color inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black uppercase text-muted dark:text-[#9b8f80] mb-1 block">
              Foreground
            </label>
            <div className="flex items-center gap-2 p-2 bg-white dark:bg-[#0f0e0c] border-2 border-black dark:border-[#2e2924] rounded-lg">
              <input
                type="color"
                value={foreground}
                readOnly
                className="w-8 h-8 rounded cursor-pointer"
              />
              <span className="font-mono text-xs font-black text-text dark:text-[#f0ebe2] uppercase">
                {foreground}
              </span>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-muted dark:text-[#9b8f80] mb-1 block">
              Background
            </label>
            <div className="flex items-center gap-2 p-2 bg-white dark:bg-[#0f0e0c] border-2 border-black dark:border-[#2e2924] rounded-lg">
              <input
                type="color"
                value={background}
                readOnly
                className="w-8 h-8 rounded cursor-pointer"
              />
              <span className="font-mono text-xs font-black text-text dark:text-[#f0ebe2] uppercase">
                {background}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
