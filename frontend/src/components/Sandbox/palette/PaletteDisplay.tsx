import React, { useState } from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import type { PaletteColor } from "./types";

interface PaletteDisplayProps {
  colors: PaletteColor[];
  showShades: boolean;
  onToggleShades: () => void;
  onSelectColor: (hex: string) => void;
  selectedHex: string | null;
}

function ColorSwatch({
  color,
  isSelected,
  onClick,
}: {
  color: PaletteColor;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyHex = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(color.hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded-xl border-2 transition-all ${
        isSelected
          ? "border-primary shadow-[3px_3px_0px_#000] scale-105"
          : "border-black/20 dark:border-[#2e2924] hover:-translate-y-1 hover:shadow-card-sm"
      }`}
    >
      <div
        className="h-24 rounded-t-[10px]"
        style={{ backgroundColor: color.hex }}
      />
      <div className="bg-white dark:bg-[#1f1c18] px-3 py-2 rounded-b-[10px]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-black text-text dark:text-[#f0ebe2] uppercase">
            {color.hex}
          </span>
          <button
            onClick={copyHex}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            title="Copy hex"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 text-muted" />
            )}
          </button>
        </div>
        <span className="font-mono text-[9px] text-muted dark:text-[#9b8f80]">
          hsl({color.hsl.h}, {color.hsl.s}%, {color.hsl.l}%)
        </span>
      </div>
    </div>
  );
}

function ShadeStrip({ shades }: { shades: string[] }) {
  return (
    <div className="flex gap-0.5 mt-2">
      {shades.map((shade, i) => (
        <div
          key={i}
          className="h-6 flex-1 rounded-sm border border-black/10 dark:border-[#2e2924]/30 first:rounded-l-md last:rounded-r-md"
          style={{ backgroundColor: shade }}
          title={shade}
        />
      ))}
    </div>
  );
}

export function PaletteDisplay({
  colors,
  showShades,
  onToggleShades,
  onSelectColor,
  selectedHex,
}: PaletteDisplayProps) {
  return (
    <div className="bg-surface-low dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-4 py-3 border-b-4 border-black dark:border-[#2e2924]">
        <span className="font-black text-xs uppercase tracking-wider text-text dark:text-[#f0ebe2]">
          Generated Palette
        </span>
        <button
          onClick={onToggleShades}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase bg-surface dark:bg-[#1f1c18] text-muted dark:text-[#c4bbae] border-2 border-black dark:border-[#2e2924] rounded-lg hover:-translate-y-0.5 transition-all"
        >
          {showShades ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showShades ? "Hide" : "Show"} Shades
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {colors.map((color) => (
            <div key={color.hex}>
              <ColorSwatch
                color={color}
                isSelected={selectedHex === color.hex}
                onClick={() => onSelectColor(color.hex)}
              />
              {showShades && <ShadeStrip shades={color.shades} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
