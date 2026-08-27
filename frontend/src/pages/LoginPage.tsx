import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { AuthPageShell } from "../features/auth/AuthPageShell";
import { fetchApi } from "../lib/api";
import { useAuth } from "../features/auth/AuthContext";
import { toast } from "react-hot-toast";
import { DraggableSticker } from "../components/ui/DraggableSticker";
import { DemoLoginButton } from "../features/auth/DemoLoginButton";
import { formatGoogleOAuthError } from "../lib/googleOAuth";
import { PasswordInput } from "../components/PasswordInput";
import { MascotBuddy, MascotState } from "../components/ui/MascotBuddy";
import {
  User,
  KeyRound,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Shield,
  CheckCircle2,
  Lock,
  Zap,
  Flame,
  X,
} from "lucide-react";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mascotState, setMascotState] = useState<MascotState>("idle");
  const [showStickers, setShowStickers] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const expired = params.get("expired");
    const redirect = params.get("redirect");

    if (expired === "true") {
      toast.error("Your session has expired. Please log in again.", {
        duration: 4000,
        position: "bottom-center",
        icon: "🔒",
      });
    }

    if (redirect) {
      sessionStorage.setItem("login_redirect", redirect);
    }
  }, []);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse: any) => {
      try {
        const rawToken =
          tokenResponse?.access_token ||
          tokenResponse?.credential ||
          tokenResponse?.id_token ||
          tokenResponse?.code ||
          "";
        const tokens = await fetchApi("/auth/google/", {
          method: "POST",
          requireAuth: false,
          body: JSON.stringify({
            access_token: rawToken,
            token: rawToken,
            credential: tokenResponse?.credential || tokenResponse?.id_token,
          }),
        });
        login(tokens);
        sessionStorage.setItem("justLoggedIn", "true");
        navigate("/dashboard");
      } catch (err: unknown) {
        setMascotState("error");
        const message = formatGoogleOAuthError(err, "backend");
        setError(message);
        toast.error(message);
      }
    },
    onError: (errorResponse) => {
      setMascotState("error");
      const message = formatGoogleOAuthError(errorResponse, "popup");
      setError(message);
      toast.error(message, { duration: 5000 });
    },
  });

  const handleGoogleDevFallback = () => {
    login({
      access: "dev-google-mock-access-token",
      refresh: "dev-google-mock-refresh-token",
      user: {
        username: "google_dev_user",
        email: "google_dev@example.com",
        is_staff: false,
      },
    });
    toast.success("Logged in as Google Dev User! 🚀");
    navigate("/dashboard");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    setMascotState("loading");

    try {
      const payload: Record<string, string> = { username, password };
      if (requires2FA && totpCode) {
        payload.totp_code = totpCode;
      }

      const tokens = await fetchApi("/auth/login/", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({ ...payload, remember: rememberMe }),
      });

      login(tokens);

      toast.success("Welcome back, builder! 🎉", {
        duration: 3000,
        position: "bottom-center",
      });

      sessionStorage.setItem("justLoggedIn", "true");
      const redirect = sessionStorage.getItem("login_redirect") || "/dashboard";
      sessionStorage.removeItem("login_redirect");
      navigate(redirect);
    } catch (err: any) {
      setMascotState("error");
      if (
        err?.requires_2fa ||
        err?.code === "2fa_required" ||
        (err?.message && err.message.includes("Two-factor"))
      ) {
        setRequires2FA(true);
        toast.error("2FA code required. Enter code from authenticator app.");
      } else {
        setError(getErrorMessage(err, "Failed to login"));
        toast.error(
          requires2FA
            ? "Invalid 2FA code or backup code."
            : "Login failed. Please check your credentials.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageShell
      mode="login"
      title="Welcome Back"
      subtitle="Sign in to access your dashboard, level up your contribution skills, and ship code."
    >
      {/* Interactive Mascot & Level Header */}
      <div className="flex flex-col items-center mb-3 text-center">
        <MascotBuddy
          state={mascotState}
          className="mb-1.5 scale-90 sm:scale-100 transition-all duration-300 hover:scale-105"
        />

        <div className="inline-flex items-center gap-1.5 bg-[#EEF2FF] dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-1">
          <Flame size={12} className="text-amber-500 animate-pulse" />
          <span>Ready to Contribute?</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          Welcome Back, Builder! 👋
        </h2>
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
          Enter your account details to jump back into code
        </p>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        {/* Animated Error Alert Notification */}
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-1.5 text-rose-800 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 p-2.5 rounded-2xl border-2 border-rose-400 dark:border-rose-800 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(244,63,94,0.4)] animate-shake"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="text-[11px] leading-tight font-extrabold">{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError("")}
                className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 text-xs font-black p-0.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/50 cursor-pointer transition-colors"
                aria-label="Dismiss error"
              >
                <X size={14} />
              </button>
            </div>
            {error.includes("Google") && (
              <button
                type="button"
                onClick={handleGoogleDevFallback}
                className="w-full mt-1 bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Zap size={12} className="text-amber-400 fill-amber-400" />
                <span>Use Local Google Dev Login</span>
              </button>
            )}
          </div>
        )}

        {!requires2FA ? (
          <>
            {/* Username or Email Input */}
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 font-black text-slate-700 dark:text-slate-300 ml-1 text-[10px] uppercase tracking-wider">
                <User size={12} className="text-indigo-500" />
                <span>Username or Email</span>
              </label>
              <div className="relative">
                <input
                  className="w-full rounded-2xl border-2 border-black dark:border-white/20 bg-white dark:bg-[#12100e] px-3.5 py-2 text-slate-900 dark:text-white font-bold outline-none placeholder:text-slate-400 focus:border-indigo-600 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 focus:shadow-[2px_2px_0px_0px_rgba(99,102,241,1)] transition-all text-xs sm:text-sm"
                  placeholder="developer@atelier.com"
                  value={username}
                  onFocus={() => setMascotState("focus-username")}
                  onBlur={() => setMascotState("idle")}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between ml-1">
                <label
                  htmlFor="login-password"
                  className="flex items-center gap-1.5 font-black text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-wider"
                >
                  <KeyRound size={12} className="text-indigo-500" />
                  <span>Password</span>
                </label>
                <a
                  href="/reset-password"
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <PasswordInput
                id="login-password"
                className="w-full rounded-2xl border-2 border-black dark:border-white/20 bg-white dark:bg-[#12100e] px-3.5 py-2 text-slate-900 dark:text-white font-bold outline-none placeholder:text-slate-400 focus:border-indigo-600 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 focus:shadow-[2px_2px_0px_0px_rgba(99,102,241,1)] transition-all text-xs sm:text-sm"
                placeholder="••••••••"
                value={password}
                onFocus={() => setMascotState("focus-password")}
                onBlur={() => setMascotState("idle")}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </>
        ) : (
          /* 2FA Verification Step */
          <div className="space-y-2.5 p-3.5 rounded-2xl border-2 border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                <Shield size={14} className="text-indigo-600" /> 2FA Verification Required
              </span>
              <button
                type="button"
                onClick={() => setRequires2FA(false)}
                className="text-[10px] font-bold text-slate-500 hover:text-black dark:hover:text-white underline cursor-pointer"
              >
                Back
              </button>
            </div>

            <div className="space-y-1">
              <label className="font-black text-slate-700 dark:text-slate-300 ml-1 text-[10px] uppercase tracking-wider">
                {useBackupCode ? "Backup Code" : "Authenticator Code (6 digits)"}
              </label>
              <input
                type="text"
                autoFocus
                maxLength={useBackupCode ? 10 : 6}
                placeholder={useBackupCode ? "a1b2-c3d4" : "123456"}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="w-full rounded-2xl border-2 border-black dark:border-white/20 bg-white dark:bg-[#12100e] px-3 py-2 text-center text-base font-mono font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-400 tracking-widest focus:ring-2 focus:ring-indigo-500 transition-all"
                required
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setTotpCode("");
              }}
              className="text-[11px] font-bold text-indigo-600 hover:underline block text-center w-full cursor-pointer"
            >
              {useBackupCode
                ? "Use Authenticator 6-digit code"
                : "Use a backup code"}
            </button>
          </div>
        )}

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between px-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded-lg border-2 border-black dark:border-white/30 accent-indigo-600 cursor-pointer"
            />
            <span>Remember me for 30 days</span>
          </label>
        </div>

        {/* Primary Action Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-2xl border-2 border-black bg-[#6366F1] hover:bg-[#4F46E5] text-white px-4 py-2.5 font-black text-xs sm:text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all cursor-pointer uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <span>
            {isLoading
              ? "Authenticating..."
              : requires2FA
                ? "Verify & Continue 🛡️"
                : "Let's Build! 🚀"}
          </span>
          {!isLoading && (
            <ArrowRight
              size={16}
              className="group-hover:translate-x-1 transition-transform"
            />
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-2 py-1">
          <div className="h-[1.5px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            OR CONNECT WITH
          </span>
          <div className="h-[1.5px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
        </div>

        {/* Secondary Actions Grid: Google Sign-In & Demo Mode */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => googleLogin()}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-black dark:border-white/20 rounded-2xl font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 bg-white dark:bg-[#12100e] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="truncate">Google</span>
          </button>

          <DemoLoginButton
            label="⚡ Demo Mode"
            className="w-full rounded-2xl border-2 border-black dark:border-white/20 bg-[#10B981] hover:bg-[#059669] text-white px-3 py-2 font-black text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all cursor-pointer uppercase flex items-center justify-center gap-1.5"
          />
        </div>

        {/* Playful Sticker Vault Interactive Toggle */}
        <div className="pt-1 flex flex-col items-center relative">
          <button
            type="button"
            onClick={() => setShowStickers(!showStickers)}
            className="text-[11px] font-black text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Sparkles size={12} className="text-amber-400 animate-spin-slow" />
            <span>
              {showStickers ? "Hide Playful Badges 🎨" : "Playful Badges 🎨"}
            </span>
          </button>

          {showStickers && (
            <div className="absolute bottom-7 bg-white dark:bg-[#1c1917] p-3 rounded-2xl border-2 border-black dark:border-white/30 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(99,102,241,0.5)] z-50 flex flex-wrap justify-center gap-2 animate-scale-up w-72">
              <DraggableSticker
                initialX={0}
                initialY={0}
                className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-sm border border-black"
              >
                Bug Hunter 🐛
              </DraggableSticker>
              <DraggableSticker
                initialX={0}
                initialY={0}
                className="bg-indigo-500 text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-sm border border-black"
              >
                git commit 🚀
              </DraggableSticker>
              <DraggableSticker
                initialX={0}
                initialY={0}
                className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-sm border border-black"
              >
                100% Merged ✅
              </DraggableSticker>
              <DraggableSticker
                initialX={0}
                initialY={0}
                className="bg-amber-400 text-black text-[10px] font-black px-2.5 py-1 rounded-xl shadow-sm border border-black"
              >
                Code Ninja 🥷
              </DraggableSticker>
            </div>
          )}
        </div>

        {/* Navigation Link to Signup */}
        <p className="text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-1">
          New to Atelier?{" "}
          <Link
            to="/signup"
            className="text-indigo-600 dark:text-indigo-400 font-black hover:underline ml-1 underline"
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthPageShell>
  );
}

export default LoginPage;
