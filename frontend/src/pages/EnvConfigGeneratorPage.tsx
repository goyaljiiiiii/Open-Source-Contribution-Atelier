import React, { useState, useMemo } from "react";
import {
  Sliders,
  Copy,
  Download,
  Check,
  AlertTriangle,
  Sparkles,
  Database,
  Key,
  ShieldCheck,
  Cpu,
  Globe,
  Server,
  Layers,
  FileCode,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface ConfigState {
  // Application
  debug: boolean;
  djangoEnv: "development" | "production";
  secretKey: string;
  allowedHosts: string;
  frontendUrl: string;

  // Database
  dbEngine: "sqlite" | "postgres" | "neon";
  databaseUrl: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbHost: string;
  dbPort: string;

  // Cache & Channels
  redisMode: "disabled" | "redis" | "upstash";
  redisUrl: string;

  // Google OAuth
  enableGoogleAuth: boolean;
  googleClientId: string;
  googleClientSecret: string;

  // GitHub OAuth
  enableGithubAuth: boolean;
  githubClientId: string;
  githubClientSecret: string;

  // AI & ML
  enableOpenAi: boolean;
  openaiApiKey: string;
  llmModel: string;
  enableHuggingFace: boolean;
  huggingFaceKey: string;

  // AWS S3 Storage
  enableAwsS3: boolean;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  s3Bucket: string;

  // Sentry
  enableSentry: boolean;
  sentryDsn: string;

  // VAPID Web Push
  enableVapid: boolean;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidAdminEmail: string;
}

const DEFAULT_CONFIG: ConfigState = {
  debug: true,
  djangoEnv: "development",
  secretKey: "change-me-to-a-secure-key-at-least-32-bytes-long",
  allowedHosts: "localhost,127.0.0.1",
  frontendUrl: "http://localhost:5173",

  dbEngine: "sqlite",
  databaseUrl:
    "postgresql://atelier_user:secure_password_here@ep-neon-db.us-east-1.aws.neon.tech/atelier_db",
  dbName: "contribution_atelier",
  dbUser: "contribution_atelier",
  dbPassword: "your-db-password-here",
  dbHost: "localhost",
  dbPort: "5432",

  redisMode: "disabled",
  redisUrl: "redis://localhost:6379/0",

  enableGoogleAuth: false,
  googleClientId:
    "27042928964-example.apps.googleusercontent.com",
  googleClientSecret: "GOCSPX-your_google_client_secret_here",

  enableGithubAuth: true,
  githubClientId: "your_github_oauth_client_id",
  githubClientSecret: "your_github_oauth_client_secret",

  enableOpenAi: false,
  openaiApiKey: "sk-proj-your_openai_api_key_here",
  llmModel: "gpt-4o-mini",
  enableHuggingFace: false,
  huggingFaceKey: "hf_your_huggingface_token_here",

  enableAwsS3: false,
  awsAccessKeyId: "AKIAIOSFODNN7EXAMPLE",
  awsSecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  awsRegion: "us-east-1",
  s3Bucket: "atelier-backup-bucket",

  enableSentry: false,
  sentryDsn: "https://examplePublicKey@o0.ingest.sentry.io/0",

  enableVapid: false,
  vapidPublicKey: "BEl62iUYgUivxIkv69yViEuiBIa45xEXAMPLE_PUBLIC_KEY",
  vapidPrivateKey: "your_vapid_private_key_here",
  vapidAdminEmail: "mailto:admin@localhost.com",
};

export function EnvConfigGeneratorPage() {
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<"backend" | "frontend">("backend");
  const [copiedBackend, setCopiedBackend] = useState(false);
  const [copiedFrontend, setCopiedFrontend] = useState(false);

  const updateConfig = <K extends keyof ConfigState>(
    key: K,
    value: ConfigState[K],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const generateRandomSecretKey = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(-_=+)" ;
    let result = "";
    for (let i = 0; i < 48; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    updateConfig("secretKey", result);
    toast.success("Generated new 48-character Django SECRET_KEY");
  };

  // Live generation of backend/.env
  const backendEnv = useMemo(() => {
    const lines: string[] = [
      "# ============================================",
      "# OPEN SOURCE CONTRIBUTION ATELIER - BACKEND .ENV",
      "# Generated via Environment Config Wizard",
      "# ============================================",
      "",
      "# ============ APPLICATION SETTINGS ============",
      `DEBUG=${config.debug ? "True" : "False"}`,
      `DJANGO_ENV=${config.djangoEnv}`,
      `SECRET_KEY=${config.secretKey}`,
      `ALLOWED_HOSTS=${config.allowedHosts}`,
      `FRONTEND_URL=${config.frontendUrl}`,
      `CORS_ALLOWED_ORIGINS=${config.frontendUrl}`,
      "",
      "# ============ DATABASE ============ ",
    ];

    if (config.dbEngine === "sqlite") {
      lines.push(
        "# SQLite (Development fallback - zero setup required)",
        "# DB_NAME=db.sqlite3",
      );
    } else if (config.dbEngine === "postgres") {
      lines.push(
        "# PostgreSQL (Local Docker / Standard Postgres)",
        `DATABASE_URL=postgresql://${config.dbUser}:${config.dbPassword}@${config.dbHost}:${config.dbPort}/${config.dbName}`,
        `DB_NAME=${config.dbName}`,
        `DB_USER=${config.dbUser}`,
        `DB_PASSWORD=${config.dbPassword}`,
        `DB_HOST=${config.dbHost}`,
        `DB_PORT=${config.dbPort}`,
      );
    } else if (config.dbEngine === "neon") {
      lines.push(
        "# Neon Postgres (Serverless Cloud Database)",
        `DATABASE_URL=${config.databaseUrl}`,
      );
    }

    lines.push("", "# ============ CACHE & REDIS ============");
    if (config.redisMode === "disabled") {
      lines.push(
        "# Redis disabled - Channels automatically falls back to InMemoryChannelLayer",
        "FORCE_INMEMORY_CHANNEL_LAYER=1",
      );
    } else if (config.redisMode === "redis") {
      lines.push(`REDIS_URL=${config.redisUrl}`);
    } else if (config.redisMode === "upstash") {
      lines.push(
        "# Upstash Cloud Redis",
        `REDIS_URL=${config.redisUrl || "rediss://default:token@upstash.io:6379"}`,
      );
    }

    if (config.enableGithubAuth) {
      lines.push(
        "",
        "# ============ GITHUB OAUTH ============",
        `GITHUB_CLIENT_ID=${config.githubClientId}`,
        `GITHUB_CLIENT_SECRET=${config.githubClientSecret}`,
      );
    }

    if (config.enableGoogleAuth) {
      lines.push(
        "",
        "# ============ GOOGLE OAUTH ============",
        `GOOGLE_CLIENT_ID=${config.googleClientId}`,
        `GOOGLE_CLIENT_SECRET=${config.googleClientSecret}`,
      );
    }

    if (config.enableOpenAi || config.enableHuggingFace) {
      lines.push("", "# ============ AI & ML SERVICES ============");
      if (config.enableOpenAi) {
        lines.push(
          `OPENAI_API_KEY=${config.openaiApiKey}`,
          `LLM_MODEL=${config.llmModel}`,
        );
      }
      if (config.enableHuggingFace) {
        lines.push(`HUGGINGFACE_API_KEY=${config.huggingFaceKey}`);
      }
    }

    if (config.enableAwsS3) {
      lines.push(
        "",
        "# ============ AWS S3 STORAGE ============",
        `AWS_ACCESS_KEY_ID=${config.awsAccessKeyId}`,
        `AWS_SECRET_ACCESS_KEY=${config.awsSecretAccessKey}`,
        `AWS_REGION=${config.awsRegion}`,
        `S3_BACKUP_BUCKET=${config.s3Bucket}`,
      );
    }

    if (config.enableSentry) {
      lines.push(
        "",
        "# ============ SENTRY ERROR TRACKING ============",
        `SENTRY_DSN=${config.sentryDsn}`,
        "SENTRY_TRACES_SAMPLE_RATE=1.0",
      );
    }

    if (config.enableVapid) {
      lines.push(
        "",
        "# ============ VAPID WEB PUSH ============",
        `VAPID_PUBLIC_KEY=${config.vapidPublicKey}`,
        `VAPID_PRIVATE_KEY=${config.vapidPrivateKey}`,
        `VAPID_ADMIN_EMAIL=${config.vapidAdminEmail}`,
      );
    }

    return lines.join("\n");
  }, [config]);

  // Live generation of frontend/.env
  const frontendEnv = useMemo(() => {
    const lines: string[] = [
      "# ============================================",
      "# OPEN SOURCE CONTRIBUTION ATELIER - FRONTEND .ENV",
      "# Generated via Environment Config Wizard",
      "# ============================================",
      "",
      "VITE_API_BASE_URL=http://localhost:8000/api",
      "VITE_GITHUB_OAUTH_URL=http://localhost:8000/api/auth/github/",
    ];

    if (config.enableGoogleAuth) {
      lines.push(
        "",
        "# Google OAuth Client ID",
        `VITE_GOOGLE_CLIENT_ID=${config.googleClientId}`,
      );
    }

    if (config.redisMode !== "disabled") {
      lines.push(
        "",
        "# Celery & Prometheus Ports",
        `CELERY_BROKER_URL=${config.redisUrl}`,
        "PROMETHEUS_PORT=9090",
      );
    }

    if (config.enableVapid) {
      lines.push(
        "",
        "# Web Push VAPID Public Key",
        `VITE_VAPID_PUBLIC_KEY=${config.vapidPublicKey}`,
      );
    }

    if (config.enableSentry) {
      lines.push(
        "",
        "# Sentry Frontend Error Tracking",
        `VITE_SENTRY_DSN=${config.sentryDsn}`,
        "VITE_SENTRY_TRACES_SAMPLE_RATE=1.0",
      );
    }

    return lines.join("\n");
  }, [config]);

  // Placeholder key warning inspector
  const warnings = useMemo(() => {
    const w: string[] = [];
    const isPlaceholder = (val: string) =>
      !val ||
      /change-me|your_|example|secret_key|here/i.test(val);

    if (isPlaceholder(config.secretKey)) {
      w.push("SECRET_KEY uses a default example value. Click 'Generate Secure Key' for production.");
    }
    if (config.enableGithubAuth && isPlaceholder(config.githubClientId)) {
      w.push("GitHub OAuth Client ID contains a placeholder value.");
    }
    if (config.enableGoogleAuth && isPlaceholder(config.googleClientId)) {
      w.push("Google OAuth Client ID contains a placeholder value.");
    }
    if (config.enableOpenAi && isPlaceholder(config.openaiApiKey)) {
      w.push("OpenAI API Key is currently set to a placeholder.");
    }
    if (config.enableHuggingFace && isPlaceholder(config.huggingFaceKey)) {
      w.push("Hugging Face API Token contains a placeholder value.");
    }
    if (config.enableAwsS3 && isPlaceholder(config.awsAccessKeyId)) {
      w.push("AWS Access Key ID contains placeholder credentials.");
    }
    if (config.enableSentry && isPlaceholder(config.sentryDsn)) {
      w.push("Sentry DSN is empty or set to placeholder.");
    }
    return w;
  }, [config]);

  const handleCopy = (type: "backend" | "frontend") => {
    const text = type === "backend" ? backendEnv : frontendEnv;
    navigator.clipboard.writeText(text);
    if (type === "backend") {
      setCopiedBackend(true);
      setTimeout(() => setCopiedBackend(false), 2000);
      toast.success("Copied backend/.env to clipboard!");
    } else {
      setCopiedFrontend(true);
      setTimeout(() => setCopiedFrontend(false), 2000);
      toast.success("Copied frontend/.env to clipboard!");
    }
  };

  const handleDownload = (type: "backend" | "frontend") => {
    const text = type === "backend" ? backendEnv : frontendEnv;
    const filename = type === "backend" ? "backend.env" : "frontend.env";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const handleDownloadBoth = () => {
    handleDownload("backend");
    setTimeout(() => handleDownload("frontend"), 300);
  };

  return (
    <div className="w-full min-h-screen bg-surface dark:bg-[#0a0a0f] text-text dark:text-[#f0ebe2] p-4 md:p-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b-2 border-black/10 dark:border-[#2e2924]">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-accent/10 border border-accent/30 text-accent">
              <Sliders className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-text dark:text-[#f0ebe2] flex items-center gap-2">
                Environment Config Generator
              </h1>
              <p className="text-sm font-medium text-muted dark:text-[#c4bbae] mt-1">
                Interactive setup wizard to configure services (Database, OAuth, Redis, AI) and generate ready-to-use <code className="font-mono text-accent">.env</code> files.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadBoth}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent/90 transition-all shadow-card-sm"
          >
            <Download className="w-4 h-4" /> Download Both Files
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid: Config Controls vs Live Code Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Controls (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Section 1: Core Django Application */}
          <div className="p-5 bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl flex flex-col gap-4 shadow-sm">
            <h3 className="text-base font-bold text-text dark:text-[#f0ebe2] flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-500" /> 1. Core Application & Environment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-muted uppercase">Environment Mode</label>
                <select
                  value={config.djangoEnv}
                  onChange={(e) =>
                    updateConfig("djangoEnv", e.target.value as any)
                  }
                  className="px-3 py-2 bg-surface-low dark:bg-[#1a1714] border border-black/20 dark:border-[#2e2924] rounded-lg font-bold text-text dark:text-[#f0ebe2]"
                >
                  <option value="development">Development</option>
                  <option value="production">Production</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-muted uppercase">Debug Mode</label>
                <button
                  type="button"
                  onClick={() => updateConfig("debug", !config.debug)}
                  className={`px-3 py-2 rounded-lg font-bold flex items-center justify-between border transition-all ${
                    config.debug
                      ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/40"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40"
                  }`}
                >
                  <span>DEBUG={config.debug ? "True" : "False"}</span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-black/10 dark:bg-white/10">
                    {config.debug ? "Dev Mode" : "Production"}
                  </span>
                </button>
              </div>

              <div className="md:col-span-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-muted uppercase">Django SECRET_KEY</label>
                  <button
                    onClick={generateRandomSecretKey}
                    className="text-[11px] font-extrabold text-accent hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Generate Secure Key
                  </button>
                </div>
                <input
                  type="text"
                  value={config.secretKey}
                  onChange={(e) => updateConfig("secretKey", e.target.value)}
                  className="px-3 py-2 bg-surface-low dark:bg-[#1a1714] border border-black/20 dark:border-[#2e2924] rounded-lg font-mono text-xs text-text dark:text-[#f0ebe2]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Database Configuration */}
          <div className="p-5 bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl flex flex-col gap-4 shadow-sm">
            <h3 className="text-base font-bold text-text dark:text-[#f0ebe2] flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-500" /> 2. Primary Database Engine
            </h3>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "sqlite", label: "SQLite", desc: "Local Zero-Config" },
                { id: "postgres", label: "PostgreSQL", desc: "Docker / Standard" },
                { id: "neon", label: "Neon Postgres", desc: "Serverless Cloud" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => updateConfig("dbEngine", item.id as any)}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    config.dbEngine === item.id
                      ? "bg-accent/15 border-accent text-accent font-black shadow-card-sm"
                      : "bg-surface-low dark:bg-[#1a1714] border-black/10 dark:border-[#2e2924] text-muted hover:text-text"
                  }`}
                >
                  <span className="text-xs font-bold">{item.label}</span>
                  <span className="text-[10px] opacity-75">{item.desc}</span>
                </button>
              ))}
            </div>

            {config.dbEngine === "postgres" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-muted uppercase">DB User</label>
                  <input
                    type="text"
                    value={config.dbUser}
                    onChange={(e) => updateConfig("dbUser", e.target.value)}
                    className="px-3 py-2 bg-surface-low dark:bg-[#1a1714] border border-black/20 dark:border-[#2e2924] rounded-lg font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-muted uppercase">DB Password</label>
                  <input
                    type="password"
                    value={config.dbPassword}
                    onChange={(e) => updateConfig("dbPassword", e.target.value)}
                    className="px-3 py-2 bg-surface-low dark:bg-[#1a1714] border border-black/20 dark:border-[#2e2924] rounded-lg font-mono"
                  />
                </div>
              </div>
            )}

            {config.dbEngine === "neon" && (
              <div className="flex flex-col gap-1 text-xs pt-2">
                <label className="font-bold text-muted uppercase">Neon Connection String (DATABASE_URL)</label>
                <input
                  type="text"
                  value={config.databaseUrl}
                  onChange={(e) => updateConfig("databaseUrl", e.target.value)}
                  className="px-3 py-2 bg-surface-low dark:bg-[#1a1714] border border-black/20 dark:border-[#2e2924] rounded-lg font-mono"
                />
              </div>
            )}
          </div>

          {/* Section 3: Cache & Real-Time Channels (Redis) */}
          <div className="p-5 bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl flex flex-col gap-4 shadow-sm">
            <h3 className="text-base font-bold text-text dark:text-[#f0ebe2] flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-500" /> 3. Redis Cache & WebSockets Layer
            </h3>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "disabled", label: "In-Memory", desc: "No Redis Required" },
                { id: "redis", label: "Local Redis", desc: "redis://localhost:6379" },
                { id: "upstash", label: "Upstash Redis", desc: "Cloud Serverless Redis" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => updateConfig("redisMode", item.id as any)}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    config.redisMode === item.id
                      ? "bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-400 font-black shadow-card-sm"
                      : "bg-surface-low dark:bg-[#1a1714] border-black/10 dark:border-[#2e2924] text-muted hover:text-text"
                  }`}
                >
                  <span className="text-xs font-bold">{item.label}</span>
                  <span className="text-[10px] opacity-75">{item.desc}</span>
                </button>
              ))}
            </div>

            {config.redisMode !== "disabled" && (
              <div className="flex flex-col gap-1 text-xs pt-2">
                <label className="font-bold text-muted uppercase">REDIS_URL</label>
                <input
                  type="text"
                  value={config.redisUrl}
                  onChange={(e) => updateConfig("redisUrl", e.target.value)}
                  className="px-3 py-2 bg-surface-low dark:bg-[#1a1714] border border-black/20 dark:border-[#2e2924] rounded-lg font-mono text-xs"
                />
              </div>
            )}
          </div>

          {/* Section 4: OAuth & Authentication */}
          <div className="p-5 bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl flex flex-col gap-4 shadow-sm">
            <h3 className="text-base font-bold text-text dark:text-[#f0ebe2] flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-500" /> 4. OAuth & Identity Providers
            </h3>

            {/* GitHub OAuth */}
            <div className="p-4 bg-surface-low dark:bg-[#1a1714] rounded-xl border border-black/10 dark:border-[#2e2924] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text dark:text-[#f0ebe2] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-accent" /> GitHub OAuth Authentication
                </span>
                <input
                  type="checkbox"
                  checked={config.enableGithubAuth}
                  onChange={(e) => updateConfig("enableGithubAuth", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-accent focus:ring-accent"
                />
              </div>

              {config.enableGithubAuth && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-muted uppercase">GITHUB_CLIENT_ID</label>
                    <input
                      type="text"
                      value={config.githubClientId}
                      onChange={(e) => updateConfig("githubClientId", e.target.value)}
                      className="px-3 py-2 bg-surface dark:bg-[#12100e] border border-black/20 dark:border-[#2e2924] rounded-lg font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-muted uppercase">GITHUB_CLIENT_SECRET</label>
                    <input
                      type="password"
                      value={config.githubClientSecret}
                      onChange={(e) => updateConfig("githubClientSecret", e.target.value)}
                      className="px-3 py-2 bg-surface dark:bg-[#12100e] border border-black/20 dark:border-[#2e2924] rounded-lg font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Google OAuth */}
            <div className="p-4 bg-surface-low dark:bg-[#1a1714] rounded-xl border border-black/10 dark:border-[#2e2924] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text dark:text-[#f0ebe2] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-red-500" /> Google OAuth SSO
                </span>
                <input
                  type="checkbox"
                  checked={config.enableGoogleAuth}
                  onChange={(e) => updateConfig("enableGoogleAuth", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-accent focus:ring-accent"
                />
              </div>

              {config.enableGoogleAuth && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-muted uppercase">GOOGLE_CLIENT_ID</label>
                    <input
                      type="text"
                      value={config.googleClientId}
                      onChange={(e) => updateConfig("googleClientId", e.target.value)}
                      className="px-3 py-2 bg-surface dark:bg-[#12100e] border border-black/20 dark:border-[#2e2924] rounded-lg font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-muted uppercase">GOOGLE_CLIENT_SECRET</label>
                    <input
                      type="password"
                      value={config.googleClientSecret}
                      onChange={(e) => updateConfig("googleClientSecret", e.target.value)}
                      className="px-3 py-2 bg-surface dark:bg-[#12100e] border border-black/20 dark:border-[#2e2924] rounded-lg font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: AI & Machine Learning */}
          <div className="p-5 bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl flex flex-col gap-4 shadow-sm">
            <h3 className="text-base font-bold text-text dark:text-[#f0ebe2] flex items-center gap-2">
              <Cpu className="w-5 h-5 text-sky-500" /> 5. AI Tutor & Machine Learning Providers
            </h3>

            {/* OpenAI */}
            <div className="p-4 bg-surface-low dark:bg-[#1a1714] rounded-xl border border-black/10 dark:border-[#2e2924] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text dark:text-[#f0ebe2]">
                  OpenAI API Integration
                </span>
                <input
                  type="checkbox"
                  checked={config.enableOpenAi}
                  onChange={(e) => updateConfig("enableOpenAi", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-accent focus:ring-accent"
                />
              </div>

              {config.enableOpenAi && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-muted uppercase">OPENAI_API_KEY</label>
                    <input
                      type="password"
                      value={config.openaiApiKey}
                      onChange={(e) => updateConfig("openaiApiKey", e.target.value)}
                      className="px-3 py-2 bg-surface dark:bg-[#12100e] border border-black/20 dark:border-[#2e2924] rounded-lg font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-muted uppercase">LLM_MODEL</label>
                    <select
                      value={config.llmModel}
                      onChange={(e) => updateConfig("llmModel", e.target.value)}
                      className="px-3 py-2 bg-surface dark:bg-[#12100e] border border-black/20 dark:border-[#2e2924] rounded-lg font-bold"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini (Fast & Budget)</option>
                      <option value="gpt-4o">gpt-4o (High Performance)</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Code Preview & Export Panel (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5 lg:sticky lg:top-8">
          {/* Warnings Banner if Placeholders detected */}
          {warnings.length > 0 && (
            <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex flex-col gap-2 text-amber-600 dark:text-amber-400">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{warnings.length} Placeholder Warning(s) Detected</span>
              </div>
              <ul className="text-[11px] list-disc list-inside space-y-1 opacity-90 font-medium">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Live Code Preview Container */}
          <div className="p-5 bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl flex flex-col gap-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-[#2e2924] pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("backend")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    activeTab === "backend"
                      ? "bg-accent text-white shadow-card-sm"
                      : "text-muted hover:text-text"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" /> backend/.env
                </button>
                <button
                  onClick={() => setActiveTab("frontend")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    activeTab === "frontend"
                      ? "bg-accent text-white shadow-card-sm"
                      : "text-muted hover:text-text"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" /> frontend/.env
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(activeTab)}
                  className="p-1.5 text-muted hover:text-text rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  title="Copy to Clipboard"
                >
                  {activeTab === "backend" && copiedBackend ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : activeTab === "frontend" && copiedFrontend ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleDownload(activeTab)}
                  className="p-1.5 text-muted hover:text-text rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Syntax Highlighted Live Output */}
            <div className="relative bg-[#0d0c0a] p-4 rounded-xl border border-black/20 dark:border-[#2e2924] overflow-x-auto max-h-[480px]">
              <pre className="text-xs font-mono text-[#f0ebe2] leading-relaxed whitespace-pre">
                {activeTab === "backend" ? backendEnv : frontendEnv}
              </pre>
            </div>

            {/* Quick Copy & Download Bar */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleCopy(activeTab)}
                className="flex items-center justify-center gap-2 py-2 px-3 bg-surface-low dark:bg-[#1a1714] border border-black/10 dark:border-[#2e2924] rounded-xl text-xs font-bold text-text dark:text-[#f0ebe2] hover:border-accent transition-all"
              >
                <Copy className="w-3.5 h-3.5" /> Copy {activeTab === "backend" ? "Backend" : "Frontend"}
              </button>

              <button
                onClick={() => handleDownload(activeTab)}
                className="flex items-center justify-center gap-2 py-2 px-3 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent/90 transition-all shadow-card-sm"
              >
                <Download className="w-3.5 h-3.5" /> Download {activeTab === "backend" ? "backend.env" : "frontend.env"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnvConfigGeneratorPage;
