import React, { useState } from "react";
import { AuthPageShell } from "../features/auth/AuthPageShell";
import { fetchApi } from "../lib/api";
import { useAuth } from "../features/auth/AuthContext";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();

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
      // Optional: Redirect to dashboard
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Failed to login");
    }
  };

  return (
    <AuthPageShell title="Welcome back" subtitle="Sign in to manage lessons, contributors, and challenge workflows." mode="login">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
        <input
          className="w-full rounded-2xl border border-outline bg-surface-lowest px-4 py-3 text-text outline-none placeholder:text-muted focus:border-primary/40"
          placeholder="Email or username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="w-full rounded-2xl border border-outline bg-surface-lowest px-4 py-3 text-text outline-none placeholder:text-muted focus:border-primary/40"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="w-full rounded-xl bg-[linear-gradient(135deg,#4f46e5,#7c72ff)] px-4 py-3 font-semibold text-white shadow-card">
          Sign In
        </button>
      </form>
    </AuthPageShell>
  );
}
