import React, { useState } from "react";
import { AuthPageShell } from "../features/auth/AuthPageShell";
import { fetchApi } from "../lib/api";

export function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      // 1. Create the account
      await fetchApi("/auth/signup/", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({ username, email, password }),
      });
      
      // 2. Redirect to a notice page instead of logging in immediately
      // This matches the flow where the user must click the email link first
      window.location.href = "/verify-notice";
      
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell 
      title="Join the Club." 
      subtitle="Say goodbye to your free time. Create an account to start suffering... I mean, studying." 
      mode="signup"
    >
      <form className="space-y-6 pt-2" onSubmit={handleSubmit}>
        {error && <div className="text-black font-bold text-sm bg-primary p-4 rounded-xl border-4 border-black shadow-card-sm">{error}</div>}
        
        <div className="space-y-2">
          <label className="font-bold text-black ml-2 uppercase tracking-wide text-sm">Username</label>
          <input
            className="w-full rounded-2xl border-4 border-black bg-white px-5 py-4 text-black font-bold outline-none placeholder:text-muted/60 focus:bg-[#ffb5e8] shadow-card-sm transition-all focus:-translate-y-1 focus:shadow-card"
            placeholder="study_master_99"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="font-bold text-black ml-2 uppercase tracking-wide text-sm">Email Address</label>
          <input
            className="w-full rounded-2xl border-4 border-black bg-white px-5 py-4 text-black font-bold outline-none placeholder:text-muted/60 focus:bg-accent shadow-card-sm transition-all focus:-translate-y-1 focus:shadow-card"
            type="email"
            placeholder="nerd@homework.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="font-bold text-black ml-2 uppercase tracking-wide text-sm">Password</label>
          <input
            className="w-full rounded-2xl border-4 border-black bg-white px-5 py-4 text-black font-bold outline-none placeholder:text-muted/60 focus:bg-tertiary shadow-card-sm transition-all focus:-translate-y-1 focus:shadow-card"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <button 
          className="w-full rounded-2xl border-4 border-black bg-accent px-5 py-5 font-black text-black text-xl shadow-card hover:bg-tertiary transition-colors cursor-pointer mt-4 uppercase disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Creating..." : "Sign Me Up!"}
        </button>
        
        <p className="text-center text-sm font-bold text-black mt-6">
          Already stuck with us? <a href="/login" className="text-primary underline decoration-2 hover:text-black">Log in here</a>
        </p>
      </form>
    </AuthPageShell>
  );
}