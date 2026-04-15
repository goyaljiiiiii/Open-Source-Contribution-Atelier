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
    <AuthPageShell 
      title="Oh, you again?" 
      subtitle="Welcome back to your favorite distraction-free zone. Drop your details below." 
      mode="login"
    >
      <form className="space-y-6 pt-2" onSubmit={handleSubmit}>
        {error && <div className="text-black font-bold text-sm bg-primary p-4 rounded-xl border-4 border-black shadow-card-sm">{error}</div>}
        
        <div className="space-y-2">
          <label className="font-bold text-black ml-2 uppercase tracking-wide text-sm">Username / Email</label>
          <input
            className="w-full rounded-2xl border-4 border-black bg-white px-5 py-4 text-black font-bold outline-none placeholder:text-muted/60 focus:bg-tertiary shadow-card-sm transition-all focus:-translate-y-1 focus:shadow-card"
            placeholder="the_smartest@kid.com"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="font-bold text-black ml-2 uppercase tracking-wide text-sm">Password</label>
          <input
            className="w-full rounded-2xl border-4 border-black bg-white px-5 py-4 text-black font-bold outline-none placeholder:text-muted/60 focus:bg-accent shadow-card-sm transition-all focus:-translate-y-1 focus:shadow-card"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="w-full rounded-2xl border-4 border-black bg-[#ffb5e8] px-5 py-5 font-black text-black text-xl shadow-card hover:bg-primary transition-colors cursor-pointer mt-4 uppercase">
          Let Me In!
        </button>
        
        <p className="text-center text-sm font-bold text-black mt-6">
          New here? <a href="/signup" className="text-primary underline decoration-2 hover:text-black">Join the chaos</a>
        </p>
      </form>
    </AuthPageShell>
  );
}
