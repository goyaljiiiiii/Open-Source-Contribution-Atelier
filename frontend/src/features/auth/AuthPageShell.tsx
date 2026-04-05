type AuthPageShellProps = {
  title: string;
  subtitle: string;
  mode: "login" | "signup";
  children: React.ReactNode;
};

export function AuthPageShell({ title, subtitle, mode, children }: AuthPageShellProps) {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[28px] border border-outline bg-surface-high/80 p-8 shadow-card backdrop-blur-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">{mode}</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-text">{title}</h1>
        <p className="mt-3 max-w-md text-muted">{subtitle}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-surface-low p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-tertiary">Program-safe</p>
            <p className="mt-2 text-sm text-muted">Built for public GitHub collaboration with clearer governance and contributor onboarding.</p>
          </div>
          <div className="rounded-2xl bg-surface-low p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">JWT auth</p>
            <p className="mt-2 text-sm text-muted">Secure admin sessions with room for future GitHub OAuth integration.</p>
          </div>
        </div>
      </div>
      <div className="rounded-[28px] border border-outline bg-surface-low/85 p-8 shadow-card backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
}
