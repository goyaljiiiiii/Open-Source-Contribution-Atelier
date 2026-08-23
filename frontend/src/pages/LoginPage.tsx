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
import { User, KeyRound, Sparkles, AlertCircle, ArrowRight, Shield } from "lucide-react";

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
        setMascotState("loading");
        const tokens = await fetchApi("/auth/google/", {
          method: "POST",
          requireAuth: false,
          body: JSON.stringify({ access_token: tokenResponse.access_token }),
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
    onError: () => {
      setMascotState("error");
      const message = formatGoogleOAuthError(undefined, "popup");
      setError(message);
      toast.error(message);
    },
  });

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

      toast.success("Welcome back! 🎉", {
        duration: 3000,
        position: "bottom-center",
      });

      sessionStorage.setItem("justLoggedIn", "true");
      const redirect = sessionStorage.getItem("login_redirect") || "/dashboard";
      sessionStorage.removeItem("login_redirect");
      navigate(redirect);
    } catch (err: any) {
      setMascotState("error");
      if (err?.requires_2fa || err?.code === "2fa_required" || (err?.message && err.message.includes("Two-factor"))) {
        setRequires2FA(true);
        toast.error("2FA code required. Enter code from authenticator app.");
      } else {
        setError(getErrorMessage(err, "Failed to login"));
        toast.error(requires2FA ? "Invalid 2FA code or backup code." : "Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageShell
      mode="login"
      title="Welcome Back"
      subtitle="Sign in to access your dashboard, complete challenges, and track your progress."
    >
      {/* Interactive Mascot Buddy Top Header */}
      <div className="flex flex-col items-center mb-6">
        <MascotBuddy state={mascotState} className="mb-3" />
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Welcome Back!
        </h2>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
          Enter your details to access your account
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Error Alert Box */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 text-red-700 bg-red-100/80 dark:bg-red-950/40 dark:text-red-400 p-3.5 rounded-2xl border-2 border-red-400 dark:border-red-900/50 text-xs font-bold shadow-card-sm animate-shake"
          >
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-300 text-xs font-black"
            >
              ✕
            </button>
          </div>
        )}

        {!requires2FA ? (
          <>
            {/* Username / Email Input */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 font-black text-slate-700 dark:text-slate-300 ml-1 text-[11px] uppercase tracking-wider">
                <User size={13} className="text-slate-500" />
                <span>Username or Email</span>
              </label>
              <input
                className="w-full rounded-xl border-2 border-black bg-white dark:bg-[#12121a] px-4 py-3 text-slate-900 dark:text-white font-bold outline-none placeholder:text-slate-400 focus:shadow-[3px_3px_0px_0px_#000] focus:border-black transition-all text-sm"
                placeholder="the_smartest@kid.com"
                value={username}
                onFocus={() => setMascotState("focus-username")}
                onBlur={() => setMascotState("idle")}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label
                  htmlFor="login-password"
                  className="flex items-center gap-1.5 font-black text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider"
                >
                  <KeyRound size={13} className="text-slate-500" />
                  <span>Password</span>
                </label>
                <a
                  href="/reset-password"
                  className="text-[11px] font-bold text-slate-500 hover:text-black dark:text-slate-400 dark:hover:text-white hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <PasswordInput
                id="login-password"
                className="w-full rounded-xl border-2 border-black bg-white dark:bg-[#12121a] px-4 py-3 text-slate-900 dark:text-white font-bold outline-none placeholder:text-slate-400 focus:shadow-[3px_3px_0px_0px_#000] focus:border-black transition-all text-sm"
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
          /* 2FA Step */
          <div className="space-y-4 p-4 rounded-2xl border-3 border-blue-500 bg-blue-50/70 dark:bg-blue-950/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <Shield size={16} /> Two-Factor Authentication
              </span>
              <button
                type="button"
                onClick={() => setRequires2FA(false)}
                className="text-[11px] font-bold text-slate-500 hover:text-black dark:hover:text-white underline"
              >
                Back
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="font-black text-slate-600 dark:text-slate-300 ml-1 text-[11px] uppercase tracking-wider">
                {useBackupCode ? "Recovery Backup Code" : "6-Digit Authenticator Code"}
              </label>
              <input
                type="text"
                autoFocus
                maxLength={useBackupCode ? 10 : 6}
                placeholder={useBackupCode ? "a1b2-c3d4" : "123456"}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="w-full rounded-xl border-2 border-black bg-white dark:bg-[#12121a] px-4 py-3 text-center text-lg font-mono font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-400 tracking-widest focus:shadow-[3px_3px_0px_0px_#000] transition-all"
                required
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setTotpCode("");
              }}
              className="text-xs font-bold text-blue-600 hover:underline block text-center w-full"
            >
              {useBackupCode ? "Use Authenticator App 6-digit code" : "Lost authenticator app? Use a backup code"}
            </button>
          </div>
        )}

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between pt-1 px-1">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-2 border-black accent-[#C3C0FF] cursor-pointer"
            />
            <span>Remember me for 30 days</span>
          </label>
        </div>

        {/* Primary Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl border-3 border-black bg-[#C3C0FF] dark:bg-[#C3C0FF] px-4 py-3.5 font-black text-black text-sm shadow-card hover:-translate-y-0.5 active:translate-y-0 active:shadow-card-sm transition-all cursor-pointer uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group mt-2"
        >
          <span>{isLoading ? "Verifying..." : requires2FA ? "Verify & Log In 🛡️" : "Let Me In!"}</span>
          {!isLoading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
        </button>

        {/* Single Clean Divider */}
        <div className="flex items-center gap-3 py-2">
          <div className="h-[2px] flex-1 bg-black/15 dark:bg-white/15"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            OR CONTINUE WITH
          </span>
          <div className="h-[2px] flex-1 bg-black/15 dark:bg-white/15"></div>
        </div>

        {/* Secondary Actions Grid: Google Sign-In & Demo Mode */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => googleLogin()}
            className="flex items-center justify-center gap-2.5 w-full px-4 py-3 border-2 border-black rounded-xl font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 bg-white dark:bg-[#12121a] shadow-card-sm hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            <span>Sign in with Google</span>
          </button>

          <DemoLoginButton
            label="⚡ Quick Demo Mode (No Login)"
            className="w-full rounded-xl border-2 border-black bg-[#6BCB77] text-black px-4 py-3 font-black text-xs shadow-card-sm hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer uppercase flex items-center justify-center gap-1.5"
          />
        </div>

        {/* Playful Sticker Vault Toggle */}
        <div className="pt-2 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setShowStickers(!showStickers)}
            className="text-[11px] font-black text-slate-500 hover:text-black dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Sparkles size={12} className="text-[#FFD93D]" />
            <span>{showStickers ? "Hide Playful Stickers 🎨" : "Show Playful Stickers 🎨"}</span>
          </button>

          {showStickers && (
            <div className="mt-3 p-3 bg-amber-50/80 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-800 rounded-2xl w-full flex flex-wrap justify-center gap-2 animate-fade-in">
              <DraggableSticker initialX={0} initialY={0} className="bg-[#FF6B6B] text-white text-xs">
                Bug Hunter 🐛
              </DraggableSticker>
              <DraggableSticker initialX={0} initialY={0} className="bg-[#4D96FF] text-white text-xs">
                git commit 🚀
              </DraggableSticker>
              <DraggableSticker initialX={0} initialY={0} className="bg-[#6BCB77] text-black text-xs">
                100% Merged ✅
              </DraggableSticker>
              <DraggableSticker initialX={0} initialY={0} className="bg-[#FFD93D] text-black text-xs">
                Git Expert 👑
              </DraggableSticker>
            </div>
          )}
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs font-bold pt-3 text-slate-500 dark:text-slate-400">
          New here?{" "}
          <Link
            to="/signup"
            className="text-black dark:text-white hover:underline font-black ml-1 underline"
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthPageShell>
  );
}

export default LoginPage;