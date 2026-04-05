import React, { useState } from "react";
import { AuthPageShell } from "../features/auth/AuthPageShell";
import { fetchApi } from "../lib/api";
import { useAuth } from "../features/auth/AuthContext";

export function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      // 1. Create the account
      await fetchApi("/auth/signup/", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({ username, email, password }),
      });
      // 2. Fetch token to login
      const tokens = await fetchApi("/auth/login/", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({ username, password }),
      });
      login(tokens);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    }
  };

  return (
    <AuthPageShell title="Create admin account" subtitle="Set up a secure account for contributor operations and curriculum management." mode="signup">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
        <input
          className="w-full rounded-2xl border border-outline bg-surface-lowest px-4 py-3 text-text outline-none placeholder:text-muted focus:border-primary/40"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="w-full rounded-2xl border border-outline bg-surface-lowest px-4 py-3 text-text outline-none placeholder:text-muted focus:border-primary/40"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          Create Account
        </button>
      </form>
    </AuthPageShell>
  );
}
