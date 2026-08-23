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
      {/* Interactive Mascot Buddy Top Header (Compact) */}
      <div className="flex flex-col items-center mb-3">
        <MascotBuddy state={mascotState} className="mb-2 scale-90 sm:scale-100" />
        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
          Welcome Back!
        </h2>
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
          Enter credentials to access your account
        </p>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        {/* Error Alert Box */}
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-1.5 text-red-700 bg-red-100/80 dark:bg-red-950/40 dark:text-red-400 p-2.5 rounded-xl border-2 border-red-400 dark:border-red-900/50 text-xs font-bold shadow-card-sm animate-shake"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-600" />
              <div className="flex-1 text-[11px] leading-tight">{error}</div>
              <button
                type="button"
                onClick={() => setError("")}
                className="text-red-500 hover:text-red-700 dark:hover:text-red-300 text-xs font-black ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            {error.includes("Google") && (
              <button
                type="button"
                onClick={handleGoogleDevFallback}
                className="w-full mt-1 bg-black text-white dark:bg-white dark:text-black py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider hover:opacity-80 transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <span>⚡ Use Local Google Dev Login</span>
              </button>
            )}
          </div>
        )}


        {!requires2FA ? (
          <>
            {/* Username / Email Input */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 font-black text-slate-700 dark:text-slate-300 ml-1 text-[10px] uppercase tracking-wider">
                <User size={12} className="text-slate-500" />
                <span>Username or Email</span>
              </label>
              <input
                className="w-full rounded-xl border-2 border-black bg-white dark:bg-[#12121a] px-3.5 py-2 text-slate-900 dark:text-white font-bold outline-none placeholder:text-slate-400 focus:shadow-[2px_2px_0px_0px_#000] focus:border-black transition-all text-xs sm:text-sm"
                placeholder="the_smartest@kid.com"
                value={username}
                onFocus={() => setMascotState("focus-username")}
                onBlur={() => setMascotState("idle")}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between ml-1">
                <label
                  htmlFor="login-password"
                  className="flex items-center gap-1 font-black text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-wider"
                >
                  <KeyRound size={12} className="text-slate-500" />
                  <span>Password</span>
                </label>
                <a
                  href="/reset-password"
                  className="text-[10px] font-bold text-slate-500 hover:text-black dark:text-slate-400 dark:hover:text-white hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <PasswordInput
                id="login-password"
                className="w-full rounded-xl border-2 border-black bg-white dark:bg-[#12121a] px-3.5 py-2 text-slate-900 dark:text-white font-bold outline-none placeholder:text-slate-400 focus:shadow-[2px_2px_0px_0px_#000] focus:border-black transition-all text-xs sm:text-sm"
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
          <div className="space-y-2.5 p-3 rounded-xl border-2 border-blue-500 bg-blue-50/70 dark:bg-blue-950/30">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <Shield size={14} /> 2FA Code Required
              </span>
              <button
                type="button"
                onClick={() => setRequires2FA(false)}
                className="text-[10px] font-bold text-slate-500 hover:text-black dark:hover:text-white underline"
              >
                Back
              </button>
            </div>

            <div className="space-y-1">
              <label className="font-black text-slate-600 dark:text-slate-300 ml-1 text-[10px] uppercase tracking-wider">
                {useBackupCode ? "Backup Code" : "Authenticator Code"}
              </label>
              <input
                type="text"
                autoFocus
                maxLength={useBackupCode ? 10 : 6}
                placeholder={useBackupCode ? "a1b2-c3d4" : "123456"}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="w-full rounded-xl border-2 border-black bg-white dark:bg-[#12121a] px-3 py-2 text-center text-base font-mono font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-400 tracking-widest focus:shadow-[2px_2px_0px_0px_#000] transition-all"
                required
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setTotpCode("");
              }}
              className="text-[11px] font-bold text-blue-600 hover:underline block text-center w-full"
            >
              {useBackupCode ? "Use Authenticator 6-digit code" : "Use a backup code"}
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
              className="w-3.5 h-3.5 rounded border-2 border-black accent-[#C3C0FF] cursor-pointer"
            />
            <span>Remember me for 30 days</span>
          </label>
        </div>

        {/* Primary Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl border-2 border-black bg-[#C3C0FF] dark:bg-[#C3C0FF] px-4 py-2.5 font-black text-black text-xs shadow-card-sm hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all cursor-pointer uppercase flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <span>{isLoading ? "Verifying..." : requires2FA ? "Verify & Log In 🛡️" : "Let Me In!"}</span>
          {!isLoading && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
        </button>

        {/* Single Clean Divider */}
        <div className="flex items-center gap-2 py-1">
          <div className="h-[1.5px] flex-1 bg-black/15 dark:bg-white/15"></div>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            OR CONTINUE WITH
          </span>
          <div className="h-[1.5px] flex-1 bg-black/15 dark:bg-white/15"></div>
        </div>

        {/* Secondary Actions Grid: Google Sign-In & Demo Mode */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => googleLogin()}
            className="flex items-center justify-center gap-1.5 w-full px-2.5 py-2 border-2 border-black rounded-xl font-black text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200 bg-white dark:bg-[#12121a] shadow-card-sm hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
            className="w-full rounded-xl border-2 border-black bg-[#6BCB77] text-black px-2.5 py-2 font-black text-[11px] shadow-card-sm hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer uppercase flex items-center justify-center gap-1"
          />
        </div>

        {/* Playful Sticker Vault Toggle */}
        <div className="pt-1 flex flex-col items-center relative">
          <button
            type="button"
            onClick={() => setShowStickers(!showStickers)}
            className="text-[10px] font-black text-slate-500 hover:text-black dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Sparkles size={11} className="text-[#FFD93D]" />
            <span>{showStickers ? "Hide Stickers 🎨" : "Playful Stickers 🎨"}</span>
          </button>

          {showStickers && (
            <div className="absolute bottom-6 bg-white dark:bg-[#1a1714] p-2.5 rounded-xl border-2 border-black shadow-card z-50 flex flex-wrap justify-center gap-1.5 animate-scale-up w-64">
              <DraggableSticker initialX={0} initialY={0} className="bg-[#FF6B6B] text-white text-[10px] px-2 py-0.5">
                Bug Hunter 🐛
              </DraggableSticker>
              <DraggableSticker initialX={0} initialY={0} className="bg-[#4D96FF] text-white text-[10px] px-2 py-0.5">
                git commit 🚀
              </DraggableSticker>
              <DraggableSticker initialX={0} initialY={0} className="bg-[#6BCB77] text-black text-[10px] px-2 py-0.5">
                100% Merged ✅
              </DraggableSticker>
            </div>
          )}
        </div>

        {/* Footer Link */}
        <p className="text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-1">
          New here?{" "}
          <Link
            to="/signup"
            className="text-black dark:text-white hover:underline font-black ml-0.5 underline"
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthPageShell>
  );
}

export default LoginPage;