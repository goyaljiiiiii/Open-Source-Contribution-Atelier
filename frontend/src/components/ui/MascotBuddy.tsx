import React, { useState } from "react";

export type MascotState =
  | "idle"
  | "focus-username"
  | "focus-password"
  | "loading"
  | "error";

interface MascotBuddyProps {
  state: MascotState;
  className?: string;
}

export function MascotBuddy({ state, className = "" }: MascotBuddyProps) {
  const [clickCount, setClickCount] = useState(0);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);

  const handleMascotClick = () => {
    const nextCount = clickCount + 1;
    setClickCount(nextCount);

    const quotes = [
      "Let's write some clean code today! 💻",
      "Ready to smash some bugs? 🐛",
      "Git commit -m 'feeling awesome'! 🚀",
      "Keep your secrets secret! 🔒",
      "You've got this, contributor! 👑",
    ];
    setSpeechBubble(quotes[nextCount % quotes.length]);

    setTimeout(() => {
      setSpeechBubble(null);
    }, 2800);
  };

  return (
    <div
      className={`relative flex flex-col items-center select-none ${className}`}
    >
      {/* Playful Speech Bubble */}
      {speechBubble && (
        <div className="absolute -top-12 z-20 bg-black text-white dark:bg-white dark:text-black font-black text-xs px-3 py-1.5 rounded-2xl shadow-card border-2 border-black dark:border-white animate-bounce text-center whitespace-nowrap">
          {speechBubble}
          <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-black dark:border-t-white" />
        </div>
      )}

      {/* Mascot SVG Character */}
      <button
        type="button"
        onClick={handleMascotClick}
        title="Click me for some motivation! ✨"
        className="group relative cursor-pointer outline-none focus:scale-105 transition-transform duration-300"
      >
        <div
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#FFD93D] border-4 border-black shadow-card flex items-center justify-center relative overflow-hidden transition-all duration-300 ${state === "error" ? "animate-bounce bg-[#FF6B6B]" : ""} ${state === "loading" ? "animate-pulse" : ""} group-hover:rotate-3`}
        >
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_2px,transparent_2px)] [background-size:8px_8px]" />

          {/* Ears / Antennae */}
          <div className="absolute -top-1 left-3 w-4 h-4 rounded-full bg-black border-2 border-white" />
          <div className="absolute -top-1 right-3 w-4 h-4 rounded-full bg-black border-2 border-white" />

          {/* FACIAL EXPRESSIONS */}

          {/* 1. PASSWORD FOCUS: Covering Eyes / Sunglasses 🙈🕶️ */}
          {state === "focus-password" ? (
            <div className="flex flex-col items-center justify-center z-10 w-full h-full relative">
              {/* Cool Sunglasses */}
              <div className="flex items-center gap-1 bg-black px-2 py-1.5 rounded-lg border-2 border-white shadow-sm animate-pulse">
                <div className="w-5 h-4 bg-slate-900 rounded-sm border border-slate-700 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                </div>
                <div className="w-1 h-0.5 bg-white" />
                <div className="w-5 h-4 bg-slate-900 rounded-sm border border-slate-700 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                </div>
              </div>
              {/* Cute Secret Smile */}
              <div className="w-4 h-1.5 border-b-3 border-black rounded-full mt-2" />
              <span className="text-[9px] font-black text-black uppercase tracking-tighter mt-0.5">
                Top Secret 🙈
              </span>
            </div>
          ) : state === "loading" ? (
            /* 2. LOADING STATE: Focus Glasses & Gear */
            <div className="flex flex-col items-center justify-center z-10">
              <div className="text-2xl animate-spin">⚡</div>
              <span className="text-[10px] font-black uppercase text-black tracking-wider mt-1">
                Verifying
              </span>
            </div>
          ) : state === "error" ? (
            /* 3. ERROR STATE: Surprised 😯 */
            <div className="flex flex-col items-center justify-center z-10">
              <div className="flex gap-3 mb-1">
                <div className="w-3.5 h-3.5 rounded-full bg-black flex items-center justify-center">
                  <div className="w-1 h-1 bg-white rounded-full" />
                </div>
                <div className="w-3.5 h-3.5 rounded-full bg-black flex items-center justify-center">
                  <div className="w-1 h-1 bg-white rounded-full" />
                </div>
              </div>
              <div className="w-4 h-4 rounded-full border-3 border-black bg-white" />
              <span className="text-[10px] font-black text-white uppercase tracking-wider mt-1">
                Ouch!
              </span>
            </div>
          ) : state === "focus-username" ? (
            /* 4. USERNAME FOCUS: Curious Eyes 👀 */
            <div className="flex flex-col items-center justify-center z-10">
              <div className="flex gap-4 mb-2">
                <div className="w-4 h-4 rounded-full bg-black relative flex items-end justify-start p-0.5">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <div className="w-4 h-4 rounded-full bg-black relative flex items-end justify-start p-0.5">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              </div>
              <div className="w-5 h-2 border-b-3 border-black rounded-full" />
            </div>
          ) : (
            /* 5. IDLE STATE: Happy Smile 😄 */
            <div className="flex flex-col items-center justify-center z-10">
              <div className="flex gap-3.5 mb-2">
                <div className="w-3.5 h-3.5 rounded-full bg-black relative">
                  <div className="w-1 h-1 bg-white rounded-full absolute top-0.5 right-0.5" />
                </div>
                <div className="w-3.5 h-3.5 rounded-full bg-black relative">
                  <div className="w-1 h-1 bg-white rounded-full absolute top-0.5 right-0.5" />
                </div>
              </div>
              <div className="w-6 h-3 border-b-4 border-black rounded-full" />
            </div>
          )}

          {/* Cute Rosy Cheeks */}
          {state !== "focus-password" && (
            <>
              <div className="absolute bottom-3 left-2 w-3 h-2 rounded-full bg-[#FF6B6B]/40" />
              <div className="absolute bottom-3 right-2 w-3 h-2 rounded-full bg-[#FF6B6B]/40" />
            </>
          )}
        </div>
      </button>
    </div>
  );
}
