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

  // ── PASSWORD STRENGTH HELPER ───────────────────────────────────────────────
  // Scores the password 0–4 based on 4 criteria:
  //   +1  length is at least 8 characters
  //   +1  contains at least one uppercase letter (A-Z)
  //   +1  contains at least one digit (0-9)
  //   +1  contains at least one special character (!@#$ etc.)
  // Returns the numeric score so the JSX below can derive bar color + label.
  const getPasswordScore = (pwd: string): number =>
    (pwd.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(pwd) ? 1 : 0) +
    (/[0-9]/.test(pwd) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pwd) ? 1 : 0);

  // Maps a score to which of the 3 strength tiers we are in:
  //   0-1  → index 0  (Weak)
  //   2-3  → index 1  (Medium)
  //   4    → index 2  (Strong)
  const getStrengthIndex = (score: number): number =>
    score <= 1 ? 0 : score <= 3 ? 1 : 2;

  // One Tailwind color class per tier, applied to the filled bars.
  // Matches the red / yellow / green traffic-light convention users expect.
  const barColors = ["bg-red-500", "bg-yellow-400", "bg-green-500"] as const;

  // Human-readable label shown below the bars.
  const strengthLabels = ["Weak password", "Medium password", "Strong password 💪"] as const;

  // Text color for the label — keeps it consistent with the bar color.
  const labelColors = ["text-red-500", "text-yellow-600", "text-green-600"] as const;
  // ── END HELPER BLOCK ───────────────────────────────────────────────────────

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
    <AuthPageShell
      title="Join the Club."
      subtitle="Say goodbye to your free time. Create an account to start suffering... I mean, studying."
      mode="signup"
    >
      <form className="space-y-6 pt-2" onSubmit={handleSubmit}>
        {error && (
          <div className="text-black font-bold text-sm bg-primary p-4 rounded-xl border-4 border-black shadow-card-sm">
            {error}
          </div>
        )}

        {/* ── USERNAME ── */}
        <div className="space-y-2">
          <label className="font-bold text-black ml-2 uppercase tracking-wide text-sm">
            Username
          </label>
          <input
            className="w-full rounded-2xl border-4 border-black bg-white px-5 py-4 text-black font-bold outline-none placeholder:text-muted/60 focus:bg-[#ffb5e8] shadow-card-sm transition-all focus:-translate-y-1 focus:shadow-card"
            placeholder="study_master_99"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        {/* ── EMAIL ── */}
        <div className="space-y-2">
          <label className="font-bold text-black ml-2 uppercase tracking-wide text-sm">
            Email Address
          </label>
          <input
            className="w-full rounded-2xl border-4 border-black bg-white px-5 py-4 text-black font-bold outline-none placeholder:text-muted/60 focus:bg-accent shadow-card-sm transition-all focus:-translate-y-1 focus:shadow-card"
            type="email"
            placeholder="nerd@homework.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* ── PASSWORD ── */}
        <div className="space-y-2">
          <label className="font-bold text-black ml-2 uppercase tracking-wide text-sm">
            Password
          </label>
          <input
            className="w-full rounded-2xl border-4 border-black bg-white px-5 py-4 text-black font-bold outline-none placeholder:text-muted/60 focus:bg-tertiary shadow-card-sm transition-all focus:-translate-y-1 focus:shadow-card"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* ── PASSWORD STRENGTH INDICATOR ────────────────────────────────────
              Only rendered once the user starts typing (password is non-empty).
              Three segmented bars + a text label give instant visual feedback.
          ──────────────────────────────────────────────────────────────────── */}
          {password && (() => {
            // Compute score and tier index once; reuse in bars + label below.
            const score = getPasswordScore(password);
            const tierIndex = getStrengthIndex(score);

            return (
              <div className="ml-1 mt-2">

                {/* Three segmented bars — one per tier (Weak / Medium / Strong).
                    A bar is "filled" (colored) when its index ≤ the current tier.
                    All bars share the same active color so the whole group reads
                    as a single progress indicator, not three separate lights.     */}
                <div className="flex gap-1.5 mb-1">
                  {(["Weak", "Medium", "Strong"] as const).map((_, i) => (
                    <div
                      key={i}
                      className={[
                        "h-2 flex-1 rounded-full border-2 border-black",
                        "transition-all duration-300",
                        // Fill bars up to and including the current tier index;
                        // leave bars beyond the tier a neutral gray.
                        i <= tierIndex ? barColors[tierIndex] : "bg-gray-200",
                      ].join(" ")}
                    />
                  ))}
                </div>

                {/* Text label — matches the bar color so they feel connected. */}
                <p className={`text-xs font-bold ml-0.5 ${labelColors[tierIndex]}`}>
                  {strengthLabels[tierIndex]}
                </p>

              </div>
            );
          })()}
          {/* ── END PASSWORD STRENGTH INDICATOR ────────────────────────────── */}

        </div>

        <button className="w-full rounded-2xl border-4 border-black bg-accent px-5 py-5 font-black text-black text-xl shadow-card hover:bg-tertiary transition-colors cursor-pointer mt-4 uppercase">
          Sign Me Up!
        </button>

        <p className="text-center text-sm font-bold text-black mt-6">
          Already stuck with us?{" "}
          <a href="/login" className="text-primary underline decoration-2 hover:text-black">
            Log in here
          </a>
        </p>
      </form>
    </AuthPageShell>
  );
}


