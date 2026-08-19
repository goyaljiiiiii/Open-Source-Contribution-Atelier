import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { Moon, Sun, ShieldCheck, Flame, Sparkles } from "lucide-react";
import { fetchApi } from "../lib/api";
import { useAuth } from "../features/auth/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { DraggableSticker } from "../components/ui/DraggableSticker";
import { DemoLoginButton } from "../features/auth/DemoLoginButton";
import { formatGoogleOAuthError } from "../lib/googleOAuth";
import { PasswordInput } from "../components/PasswordInput";
import { toast } from "react-hot-toast";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

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
    label: "Git Master",
    emoji: "👑",
    color: "bg-[#4D96FF]",
    textColor: "text-white",
    quote: "Master of interactive rebase & cherry-picking.",
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const login = auth.login;

  const { theme, toggleTheme } = useTheme();
  const [authRole, setAuthRole] = useState<"student" | "admin">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [activeVibe, setActiveVibe] = useState<VibeOption>(VIBE_OPTIONS[0]);
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number; y: number }[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const authError = new URLSearchParams(window.location.search).get(
        "auth_error"
      );
      if (authError) {
        setError(authError);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const tokens = await fetchApi("/auth/login/", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({ username: email, password }),
      });
      login(tokens);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Login failed. Check your credentials."));
    }
  };

  const googleLoginHandler = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const tokens = await fetchApi("/auth/google/", {
          method: "POST",
          requireAuth: false,
          body: JSON.stringify({ access_token: tokenResponse.access_token }),
        });
        login(tokens);
        navigate("/dashboard");
      } catch (err: unknown) {
        setError(formatGoogleOAuthError(err, "backend"));
      }
    },
    onError: () => {
      setError(formatGoogleOAuthError(undefined, "popup"));
    },
  });

  const handleVibeClick = (vibe: VibeOption, e: React.MouseEvent) => {
    setActiveVibe(vibe);
    const rect = e.currentTarget.getBoundingClientRect();
    const newBursts = Array.from({ length: 4 }).map((_, i) => ({
      id: Date.now() + i,
      emoji: vibe.emoji,
      x: rect.left + rect.width / 2 + (Math.random() * 60 - 30),
      y: rect.top - 15 - (Math.random() * 30),
    }));
    setBursts((prev) => [...prev, ...newBursts]);
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => !newBursts.some((nb) => nb.id === b.id)));
    }, 800);
  };

  return (
    <div className="min-h-screen w-full bg-surface-lowest dark:bg-[#0a0a0f] text-text transition-colors duration-300 relative flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-x-hidden">
      {/* FLOATING EMOJI PARTICLES FOR PLAYFUL INTERACTION */}
      {bursts.map((b) => (
        <div
          key={b.id}
          className="fixed text-2xl select-none pointer-events-none animate-bounce z-50 transition-all"
          style={{ left: b.x, top: b.y }}
        >
          {b.emoji}
        </div>
      ))}

      {/* DRAGGABLE STICKERS - DESKTOP ONLY, SAFELY POSITIONED OUTSIDE CONTENT */}
      <div className="hidden xl:block select-none pointer-events-auto">
        <DraggableSticker initialX={40} initialY={40} className="bg-[#FF6B6B] text-white rotate-[-5deg]">
          Bug Hunter 🐛
        </DraggableSticker>

        <DraggableSticker initialX={500} initialY={30} className="bg-[#6BCB77] text-black rotate-[6deg]">
          100% Merged ✅
        </DraggableSticker>

        <DraggableSticker initialX={50} initialY={560} className="bg-[#FFD93D] text-black rotate-[-6deg]">
          Git Master 👑
        </DraggableSticker>

        <DraggableSticker initialX={440} initialY={570} className="bg-[#4D96FF] text-white rotate-[8deg]">
          git commit -m "success" 🚀
        </DraggableSticker>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center z-10 my-auto">
        {/* LEFT COLUMN: Clean, Spacious Hero Section */}
        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
          {/* Top Tag & Theme Toggle */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <span className="font-black text-xs bg-accent text-black px-4 py-2 rounded-full border-2 border-black rotate-[-2deg] inline-flex items-center gap-1.5 shadow-card-sm">
              <ShieldCheck size={14} /> AUTHORIZED ACCESS ONLY
            </span>
            <button
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              className="rounded-xl bg-surface-low p-2 text-muted hover:text-text border-2 border-black dark:border-[#4a4238] shadow-card-sm hover:-translate-y-0.5 active:translate-y-0 transition-all dark:bg-[#151411] dark:text-[#c4bbae] dark:hover:text-[#f0ebe2] toggle-theme cursor-pointer"
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>

          {/* Headline & Subtitle */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-black dark:text-white tracking-tight leading-none uppercase">
              Contribution <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500">
                Atelier
              </span>
            </h1>
            <p className="text-muted dark:text-[#9b8f80] text-base sm:text-lg font-bold max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Make your first open source contribution with guided mentorship, interactive tools, and real-world projects.
            </p>
          </div>

          {/* PLAYFUL ELEMENT: Lightweight Interactive Dev Vibe Bar */}
          <div className="pt-2 max-w-lg mx-auto lg:mx-0 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-muted dark:text-[#9b8f80]">
              <span className="flex items-center gap-1.5 font-black uppercase text-black dark:text-[#f0ebe2]">
                <Sparkles size={14} className="text-amber-500 animate-spin" /> Interactive Dev Vibe:
              </span>
              <span className="text-[10px] font-bold">Tap a mood 🎨</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {VIBE_OPTIONS.map((vibe) => {
                const isActive = activeVibe.id === vibe.id;
                return (
                  <button
                    key={vibe.id}
                    type="button"
                    onClick={(e) => handleVibeClick(vibe, e)}
                    className={`py-2 px-2.5 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? `${vibe.color} ${vibe.textColor} border-black shadow-card-sm -translate-y-0.5`
                        : "bg-white dark:bg-[#151411] border-black/20 dark:border-white/20 text-black dark:text-white hover:border-black hover:-translate-y-0.5"
                    }`}
                  >
                    <span>{vibe.emoji}</span>
                    <span className="truncate">{vibe.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Vibe Status */}
            <div className={`p-3 rounded-2xl border-2 border-black ${activeVibe.color} ${activeVibe.textColor} shadow-card-sm flex items-center justify-between gap-3 transition-all`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{activeVibe.emoji}</span>
                <span className="text-xs font-black">{activeVibe.quote}</span>
              </div>
              <Flame size={18} className="animate-pulse flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Clean, Responsive Login Card */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto bg-white dark:bg-[#151411] rounded-[2.5rem] border-4 border-black dark:border-[#4a4238] shadow-card p-6 sm:p-8 relative z-20">
          {/* Contributor / Maintainer Role Tabs */}
          <div className="flex p-1 bg-surface-low dark:bg-[#0f0e0c] rounded-2xl border-2 border-black dark:border-[#4a4238] mb-6">
            <button
              type="button"
              onClick={() => setAuthRole("student")}
              className={`flex-1 py-3 px-4 text-center font-black rounded-xl transition-all text-sm border-2 menu-tab cursor-pointer ${
                authRole === "student"
                  ? "bg-white dark:bg-[#1f1c18] border-black dark:border-[#4a4238] shadow-card-sm -translate-y-0.5 text-black dark:text-[#f0ebe2]"
                  : "border-transparent text-muted dark:text-[#9b8f80] hover:text-text dark:hover:text-[#f0ebe2]"
              }`}
            >
              Contributor
            </button>
            <button
              type="button"
              onClick={() => setAuthRole("admin")}
              className={`flex-1 py-3 px-4 text-center font-black rounded-xl transition-all text-sm border-2 menu-tab cursor-pointer ${
                authRole === "admin"
                  ? "bg-white dark:bg-[#1f1c18] border-black dark:border-[#4a4238] shadow-card-sm -translate-y-0.5 text-black dark:text-[#f0ebe2]"
                  : "border-transparent text-muted dark:text-[#9b8f80] hover:text-text dark:hover:text-[#f0ebe2]"
              }`}
            >
              Maintainer
            </button>
          </div>

          <h2 className="text-xl font-black mb-4 text-center text-text dark:text-[#f0ebe2]">
            {authRole === "student" ? "Start Your First Contribution" : "Maintainer Login"}
          </h2>

          {error && (
            <div className="text-black font-bold text-sm bg-primary p-3 rounded-xl border-4 border-black shadow-card-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => googleLoginHandler()}
              className="w-full bg-white border-4 border-black rounded-2xl py-3 px-4 flex items-center justify-center gap-3 font-black text-black hover:bg-surface-low transition-all shadow-card-sm active:translate-y-1 active:shadow-none text-sm cursor-pointer toggle-google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <DemoLoginButton
              label="🚀 Demo Mode (explicit local demo)"
              className="w-full bg-green-200 border-4 border-black rounded-2xl py-3 px-4 flex items-center justify-center gap-3 font-black text-black hover:bg-green-300 transition-all shadow-card-sm active:translate-y-1 active:shadow-none text-sm cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-4 my-5">
            <div className="flex-1 h-[2px] bg-black dark:bg-[#4a4238]" />
            <span className="font-black text-muted dark:text-[#9b8f80] text-xs uppercase tracking-wider">or</span>
            <div className="flex-1 h-[2px] bg-black dark:bg-[#4a4238]" />
          </div>

          <form onSubmit={handleStandardLogin} className="space-y-3">
            <input
              className="w-full rounded-xl border-4 border-black dark:border-[#4a4238] bg-surface-lowest dark:bg-[#0f0e0c] px-4 py-3 text-text dark:text-[#f0ebe2] font-black outline-none placeholder:text-muted/60 dark:placeholder:text-[#9b8f80]/70 focus:bg-surface-low dark:focus:bg-[#1f1c18] focus:ring-0 transition-colors shadow-sm text-sm"
              placeholder="Email or username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <PasswordInput
              id="landing-password"
              className="w-full rounded-xl border-4 border-black dark:border-[#4a4238] bg-surface-lowest dark:bg-[#0f0e0c] px-4 py-3 text-text dark:text-[#f0ebe2] font-black outline-none placeholder:text-muted/60 dark:placeholder:text-[#9b8f80]/70 focus:bg-surface-low dark:focus:bg-[#1f1c18] focus:ring-0 transition-colors shadow-sm text-sm"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="submit"
              className="w-full rounded-2xl border-4 border-black bg-primary px-5 py-3.5 font-black text-black text-base shadow-card hover:-translate-y-1 hover:shadow-card-lg active:translate-y-0 active:shadow-none transition-all uppercase tracking-wide mt-2 cursor-pointer toggle-signin"
            >
              Sign In
            </button>
          </form>

          <div className="flex items-center gap-4 my-5">
            <div className="flex-1 h-[2px] bg-black dark:bg-[#4a4238]" />
            <span className="font-black text-muted dark:text-[#9b8f80] text-[10px] uppercase tracking-wider">
              New Contributors
            </span>
            <div className="flex-1 h-[2px] bg-black dark:bg-[#4a4238]" />
          </div>

          <a
            href="/signup"
            className="flex items-center justify-center w-full rounded-2xl border-4 border-black bg-[#C3C0FF] px-5 py-3.5 font-black text-black text-base shadow-card-sm hover:-translate-y-1 hover:shadow-card active:translate-y-0 active:shadow-none transition-all uppercase tracking-wide cursor-pointer"
          >
            Create an account
          </a>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;