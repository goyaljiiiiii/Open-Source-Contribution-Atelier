import React, { useState } from "react";
import { Download, Copy, Check, Code2, Braces } from "lucide-react";
import type { PaletteColor } from "./types";

interface ExportPanelProps {
  colors: PaletteColor[];
  paletteName: string;
}

type ExportFormat = "css" | "scss" | "json" | "tailwind";

function buildExportCode(
  colors: PaletteColor[],
  paletteName: string,
  format: ExportFormat,
): string {
  const safeName = paletteName.replace(/\s+/g, "-").toLowerCase();
  const colorMap: Record<string, Record<string, string>> = {};
  colors.forEach((c, i) => {
    const key = `${safeName}-${i + 1}`;
    colorMap[key] = {};
    [95, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5].forEach((shade, si) => {
      colorMap[key][`${shade}`] = c.shades[si];
    });
    colorMap[key]["base"] = c.hex;
  });

  switch (format) {
    case "css": {
      const lines = [`:root {`];
      Object.entries(colorMap).forEach(([name, shades]) => {
        Object.entries(shades).forEach(([shade, hex]) => {
          lines.push(`  --${name}-${shade}: ${hex};`);
        });
      });
      lines.push(`}`);
      return lines.join("\n");
    }

    case "scss": {
      const lines: string[] = [];
      Object.entries(colorMap).forEach(([name, shades]) => {
        Object.entries(shades).forEach(([shade, hex]) => {
          lines.push(`$${name}-${shade}: ${hex};`);
        });
      });
      return lines.join("\n");
    }

    case "json": {
      return JSON.stringify(colorMap, null, 2);
    }

    case "tailwind": {
      const lines = [`module.exports = {`, `  theme: {`, `    extend: {`, `      colors: {`];
      Object.entries(colorMap).forEach(([name, shades]) => {
        lines.push(`        '${name}': {`);
        Object.entries(shades).forEach(([shade, hex]) => {
          lines.push(`          ${shade}: '${hex}',`);
        });
        lines.push(`        },`);
      });
      lines.push(`      },`, `    },`, `  },`, `};`);
      return lines.join("\n");
    }
  }
}

export function ExportPanel({ colors, paletteName }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("css");
  const [copied, setCopied] = useState(false);

  const code = buildExportCode(colors, paletteName, format);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extMap: Record<ExportFormat, string> = {
      css: "css",
      scss: "scss",
      json: "json",
      tailwind: "js",
    };
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `palette.${extMap[format]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-surface-low dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-4 py-3 border-b-4 border-black dark:border-[#2e2924]">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <span className="font-black text-xs uppercase tracking-wider text-text dark:text-[#f0ebe2]">
            Export
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase bg-primary text-black border-2 border-black rounded-lg hover:-translate-y-0.5 transition-all"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase bg-surface dark:bg-[#1f1c18] text-muted dark:text-[#c4bbae] border-2 border-black dark:border-[#2e2924] rounded-lg hover:-translate-y-0.5 transition-all"
          >
            <Download className="w-3 h-3" /> Download
          </button>
        </div>
      </div>

      {/* Format tabs */}
      <div className="flex border-b-2 border-black/10 dark:border-[#2e2924]">
        {(["css", "scss", "json", "tailwind"] as ExportFormat[]).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
              format === f
                ? "bg-primary/10 text-primary border-b-2 border-primary"
                : "text-muted dark:text-[#9b8f80] hover:text-text dark:hover:text-[#f0ebe2]"
            }`}
          >
            <Braces className="w-3 h-3 inline mr-1" />
            {f === "tailwind" ? "Tailwind" : f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div className="p-4 overflow-auto max-h-[300px]">
        <pre className="font-mono text-[11px] leading-relaxed text-text dark:text-[#f0ebe2] whitespace-pre-wrap">
          {code}
        </pre>
      </div>
    </div>
  );
}
