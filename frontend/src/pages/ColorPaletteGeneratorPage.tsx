import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ColorPaletteGenerator } from "../components/Sandbox/ColorPaletteGenerator";

export function ColorPaletteGeneratorPage() {
  return (
    <div className="pt-20 min-h-screen bg-white dark:bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <Link
          to="/sandbox"
          className="inline-flex items-center gap-2 font-black text-xs uppercase px-3 py-2 bg-surface-low border-2 border-black rounded-lg text-black dark:bg-[#151411] dark:border-[#2e2924] dark:text-[#f0ebe2] hover:-translate-y-0.5 shadow-card-sm transition-all"
        >
          <ArrowLeft size={14} />
          Back to Sandboxes
        </Link>
      </div>
      <div className="px-4 sm:px-6 py-6">
        <ColorPaletteGenerator />
      </div>
    </div>
  );
}
