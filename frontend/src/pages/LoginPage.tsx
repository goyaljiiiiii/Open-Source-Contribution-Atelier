import React, { useState } from "react";
import { GitBranch } from "lucide-react";
import { AuthPageShell } from "../features/auth/AuthPageShell";
import { fetchApi } from "../lib/api";
import { useAuth } from "../features/auth/AuthContext";

const githubAuthUrl =
  import.meta.env.VITE_GITHUB_OAUTH_URL ||
  `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api"}/auth/github/`;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleGithubSignIn = () => {
    window.location.href = githubAuthUrl;
  };

  const handleGoogleSignIn = () => {
    window.location.href = '/api/auth/google/';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const tokens = await fetchApi("/auth/login/", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({ username, password }),
      });
      login(tokens);
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to login"));
    }
  };

  return (
    <AuthPageShell
      title="Oh, you again?"
      subtitle="Welcome back to your favorite distraction-free zone. Drop your details below."
    >
      <form className="space-y-6 pt-2" onSubmit={handleSubmit}>
        {error && (
          <div
            role="alert"
            className="text-black font-bold text-sm bg-primary p-4 rounded-lg border-4 border-black shadow-card-sm"
          >
            {error}
          </div>
        )}

        {/* ✅ Google Login Button - CORRECT React format */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition text-sm font-semibold"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        {/* GitHub Login Button */}
        <button
          type="button"
          onClick={handleGithubSignIn}
          className="group relative w-full overflow-hidden rounded-lg border-4 border-black bg-black px-5 py-4 font-black text-white text-lg shadow-card transition-all duration-300 hover:-translate-y-1 hover:bg-text hover:shadow-card-lg cursor-pointer uppercase flex items-center justify-center gap-3 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent before:transition-transform before:duration-500 hover:before:translate-x-full"
          aria-label="Sign in with GitHub"
        >
          <GitBranch
            className="mr-2 inline-block relative transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110"
            size={20}
            strokeWidth={2.75}
            aria-hidden="true"
          />
          <span className="relative">Sign in with GitHub</span>
        </button>

        <div className="flex items-center gap-4">
          <div className="h-1 flex-1 bg-black"></div>
          <span className="text-sm font-black uppercase text-muted">OR</span>
          <div className="h-1 flex-1 bg-black"></div>
        </div>

        <div className="space-y-2">
          <label className="font-bold text-black ml-2 uppercase tracking-wide text-sm">
            Username / Email
          </label>
          <input
            className="w-full rounded-2xl border-4 border-black bg-white px-5 py-4 text-black font-bold outline-none placeholder:text-muted/60 focus:bg-tertiary shadow-card-sm transition-all focus:-translate-y-1 focus:shadow-card"
            placeholder="the_smartest@kid.com"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="font-bold text-black ml-2 uppercase tracking-wide text-sm">
            Password
          </label>
          <input
            className="w-full rounded-2xl border-4 border-black bg-white px-5 py-4 text-black font-bold outline-none placeholder:text-muted/60 focus:bg-accent shadow-card-sm transition-all focus:-translate-y-1 focus:shadow-card"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="w-full rounded-2xl border-4 border-black bg-primary px-5 py-5 font-black text-black text-xl shadow-card hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-card-sm transition-all cursor-pointer mt-4 uppercase">
          Let Me In!
        </button>

        <p className="text-center text-sm font-bold text-black mt-6">
          New here?{" "}
          <a
            href="/signup"
            className="text-primary underline decoration-2 hover:text-black"
          >
            Join the chaos
          </a>
        </p>
      </form>
    </AuthPageShell>
  );
}
