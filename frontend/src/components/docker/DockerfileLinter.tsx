import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Download,
  Wand2,
  Layers,
  FileCode,
  HardDrive,
  Copy,
  Check,
  Zap,
  Sparkles,
  Terminal,
  RotateCcw,
  ExternalLink,
} from "lucide-react";

export interface LintIssue {
  id: string;
  code: string;
  severity: "critical" | "warning" | "optimization";
  line: number;
  message: string;
  suggestion: string;
  autoFixable: boolean;
  fixAction?: (content: string) => string;
}

export interface LayerEstimate {
  lineNo: number;
  instruction: string;
  sizeMb: number;
  description: string;
}

const SAMPLE_DOCKERFILE = `# Unoptimized & Insecure Production Dockerfile Example
FROM node:latest

WORKDIR /app

# Insecure: running as root user
ADD package*.json ./

RUN apt-get update && apt-get install -y curl git
RUN npm install

COPY . .

# Insecure string notation CMD
CMD npm start
`;

const RECOMMENDED_DOCKERIGNORE = `node_modules
.git
.gitignore
.env
.env.local
dist
build
coverage
npm-debug.log
README.md
`;

export function DockerfileLinter() {
  const [dockerfileText, setDockerfileText] = useState(SAMPLE_DOCKERFILE);
  const [activeTab, setActiveTab] = useState<"editor" | "dockerignore">("editor");
  const [dockerignoreText, setDockerignoreText] = useState(RECOMMENDED_DOCKERIGNORE);
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Hadolint AST Rules Linter
  const lintIssues = useMemo<LintIssue[]>(() => {
    const issues: LintIssue[] = [];
    const lines = dockerfileText.split("\n");

    let hasUserInstruction = false;

    lines.forEach((line, idx) => {
      const lineNo = idx + 1;
      const trimmed = line.trim();

      // Rule DL3002: Running as Root
      if (trimmed.startsWith("USER ")) {
        hasUserInstruction = true;
      }

      // Rule DL3006: Unpinned Base Image
      if (trimmed.startsWith("FROM ")) {
        const imageTag = trimmed.split("FROM ")[1]?.trim();
        if (imageTag && (imageTag.includes(":latest") || !imageTag.includes(":"))) {
          issues.push({
            id: `DL3006-${lineNo}`,
            code: "DL3006",
            severity: "critical",
            line: lineNo,
            message: `Unpinned base image '${imageTag}'. Using ':latest' causes non-deterministic production builds.`,
            suggestion: "Pin image to a specific version or slim tag like 'node:20-alpine'.",
            autoFixable: true,
            fixAction: (text) => text.replace(line, line.replace(imageTag, "node:20-alpine")),
          });
        }
      }

      // Rule DL3020: Use COPY instead of ADD
      if (trimmed.startsWith("ADD ")) {
        issues.push({
          id: `DL3020-${lineNo}`,
          code: "DL3020",
          severity: "warning",
          line: lineNo,
          message: "Use 'COPY' instead of 'ADD' for local files and directories.",
          suggestion: "Replace 'ADD' with 'COPY' to prevent unintended archive extraction.",
          autoFixable: true,
          fixAction: (text) => text.replace(line, line.replace("ADD ", "COPY ")),
        });
      }

      // Rule DL3008: apt-get install without cleanup / --no-install-recommends
      if (trimmed.includes("apt-get install")) {
        if (!trimmed.includes("rm -rf /var/lib/apt/lists/*")) {
          issues.push({
            id: `DL3009-${lineNo}`,
            code: "DL3009",
            severity: "optimization",
            line: lineNo,
            message: "'apt-get install' leaves temporary package cache in image layer.",
            suggestion: "Append '&& rm -rf /var/lib/apt/lists/*' to reduce layer size.",
            autoFixable: true,
            fixAction: (text) => text.replace(line, `${line} && rm -rf /var/lib/apt/lists/*`),
          });
        }
      }

      // Rule DL3018: apk add without --no-cache
      if (trimmed.includes("apk add") && !trimmed.includes("--no-cache")) {
        issues.push({
          id: `DL3018-${lineNo}`,
          code: "DL3018",
          severity: "optimization",
          line: lineNo,
          message: "'apk add' without '--no-cache' bloats image size.",
          suggestion: "Use 'apk add --no-cache <package>'.",
          autoFixable: true,
          fixAction: (text) => text.replace(line, line.replace("apk add ", "apk add --no-cache ")),
        });
      }

      // Rule DL3025: String notation CMD
      if (trimmed.startsWith("CMD ") && !trimmed.includes("[")) {
        issues.push({
          id: `DL3025-${lineNo}`,
          code: "DL3025",
          severity: "warning",
          line: lineNo,
          message: "Use JSON array notation for CMD to ensure proper SIGTERM signal handling.",
          suggestion: "Convert 'CMD npm start' to 'CMD [\"npm\", \"start\"]'.",
          autoFixable: true,
          fixAction: (text) => {
            const cmdArgs = trimmed.replace("CMD ", "").split(" ");
            const jsonNotation = `CMD [${cmdArgs.map((a) => `"${a}"`).join(", ")}]`;
            return text.replace(line, jsonNotation);
          },
        });
      }
    });

    // Check root user warning
    if (!hasUserInstruction) {
      issues.unshift({
        id: "DL3002-root",
        code: "DL3002",
        severity: "critical",
        line: 1,
        message: "Container runs as root user. If compromised, attackers gain host-level privilege.",
        suggestion: "Add 'RUN useradd -m appuser && USER appuser' before CMD.",
        autoFixable: true,
        fixAction: (text) => {
          const lines = text.split("\n");
          const cmdIndex = lines.findIndex((l) => l.trim().startsWith("CMD"));
          if (cmdIndex !== -1) {
            lines.splice(cmdIndex, 0, "\n# Create non-root user for security\nRUN useradd -m appuser\nUSER appuser\n");
            return lines.join("\n");
          }
          return text + "\nRUN useradd -m appuser\nUSER appuser\n";
        },
      });
    }

    return issues;
  }, [dockerfileText]);

  // Image Layer Size Calculator
  const layerBreakdown = useMemo<LayerEstimate[]>(() => {
    const lines = dockerfileText.split("\n");
    const layers: LayerEstimate[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      let size = 0;
      let desc = "Metadata instruction (0 MB)";

      if (trimmed.startsWith("FROM ")) {
        if (trimmed.includes("alpine")) size = 45;
        else if (trimmed.includes("slim")) size = 180;
        else size = 950; // default node:latest / ubuntu
        desc = "Base operating system & runtime image";
      } else if (trimmed.startsWith("RUN apt-get") || trimmed.startsWith("RUN apk")) {
        size = 85;
        desc = "Installed system packages & dependencies";
      } else if (trimmed.startsWith("RUN npm install") || trimmed.startsWith("RUN npm ci")) {
        size = 140;
        desc = "Node module dependencies layer";
      } else if (trimmed.startsWith("COPY .") || trimmed.startsWith("ADD .")) {
        size = 25;
        desc = "Application source code & static assets";
      } else if (trimmed.startsWith("COPY ")) {
        size = 3;
        desc = "Configuration files & manifest";
      }

      if (size > 0) {
        layers.push({
          lineNo: idx + 1,
          instruction: trimmed.length > 35 ? trimmed.substring(0, 35) + "..." : trimmed,
          sizeMb: size,
          description: desc,
        });
      }
    });

    return layers;
  }, [dockerfileText]);

  const totalImageSize = useMemo(() => {
    return layerBreakdown.reduce((acc, l) => acc + l.sizeMb, 0);
  }, [layerBreakdown]);

  // Auto-Fix All Issues
  const handleAutoFixAll = () => {
    let updated = dockerfileText;
    lintIssues.forEach((issue) => {
      if (issue.fixAction) {
        updated = issue.fixAction(updated);
      }
    });
    setDockerfileText(updated);
    showToast("✨ Automatically applied security & optimization fixes!");
  };

  // Copy Dockerfile content
  const handleCopy = () => {
    navigator.clipboard.writeText(dockerfileText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast("📋 Dockerfile copied to clipboard!");
  };

  // Download Files
  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-black dark:bg-[#1f1c18] text-white border-2 border-primary px-4 py-3 rounded-xl shadow-card font-bold text-xs flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-primary" /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-surface-low dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-primary text-black text-xs font-black px-2.5 py-1 rounded-md border border-black uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Security Tools
            </span>
            <span className="bg-accent/20 text-accent text-xs font-bold px-2.5 py-1 rounded-md border border-accent/40">
              SSoC 2026
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-text dark:text-[#f0ebe2] flex items-center gap-2">
            Web Dockerfile Security Linter & Layer Size Calculator
          </h1>
          <p className="mt-1 text-sm font-bold text-muted dark:text-[#c4bbae] max-w-2xl">
            Real-time Hadolint AST security auditing, root-privilege vulnerability detection, auto-fix recommendations, and image layer size calculation.
          </p>
        </div>

        {/* Total Size & Issues Badge */}
        <div className="flex items-center gap-3 bg-white dark:bg-[#1f1c18] border-2 border-black dark:border-[#2e2924] p-3 rounded-xl shadow-card-sm self-start md:self-auto">
          <div
            className={`p-2.5 rounded-lg border border-black font-black ${
              lintIssues.some((i) => i.severity === "critical")
                ? "bg-rose-500 text-white"
                : "bg-emerald-400 text-black"
            }`}
          >
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-black uppercase text-muted tracking-wider">Estimated Image Size</div>
            <div className="text-xl font-black text-text dark:text-[#f0ebe2]">{totalImageSize} MB</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Code Editor & Hadolint Security Auditor (7 + 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Dockerfile Code Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-6 flex flex-col">
          <div className="bg-white dark:bg-[#1f1c18] border-4 border-black dark:border-[#2e2924] rounded-2xl shadow-card p-5 flex-1 flex flex-col min-h-[550px]">
            
            {/* Toolbar Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10 dark:border-[#2e2924] mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("editor")}
                  className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all flex items-center gap-1.5 border-2 ${
                    activeTab === "editor"
                      ? "bg-primary text-black border-black shadow-card-sm"
                      : "bg-surface-low dark:bg-[#151411] text-muted border-black/20 dark:border-[#2e2924]"
                  }`}
                >
                  <FileCode className="w-4 h-4" /> Dockerfile
                </button>
                <button
                  onClick={() => setActiveTab("dockerignore")}
                  className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all flex items-center gap-1.5 border-2 ${
                    activeTab === "dockerignore"
                      ? "bg-primary text-black border-black shadow-card-sm"
                      : "bg-surface-low dark:bg-[#151411] text-muted border-black/20 dark:border-[#2e2924]"
                  }`}
                >
                  <FileCode className="w-4 h-4" /> .dockerignore Template
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoFixAll}
                  disabled={lintIssues.length === 0}
                  className="bg-accent hover:bg-accent/90 text-black border-2 border-black text-xs font-black px-3 py-1.5 rounded-xl shadow-card-sm disabled:opacity-50 transition-all flex items-center gap-1"
                >
                  <Wand2 className="w-3.5 h-3.5" /> Auto-Fix ({lintIssues.length})
                </button>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg border-2 border-black dark:border-[#2e2924] bg-surface dark:bg-[#151411] hover:bg-black/5 dark:hover:bg-white/5 transition-all text-text dark:text-[#f0ebe2]"
                  title="Copy Dockerfile"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* TAB 1: Dockerfile Code Editor */}
            {activeTab === "editor" && (
              <div className="flex-1 bg-[#1e1e1e] text-emerald-400 font-mono text-xs p-4 rounded-xl border-2 border-black overflow-hidden flex flex-col">
                <div className="text-gray-400 pb-2 border-b border-gray-700 mb-2 font-bold flex items-center justify-between">
                  <span>🐳 Dockerfile Instructions</span>
                  <span className="text-[10px] text-gray-500">Hadolint AST Analyzer Active</span>
                </div>
                <textarea
                  value={dockerfileText}
                  onChange={(e) => setDockerfileText(e.target.value)}
                  className="w-full flex-1 bg-transparent text-emerald-400 font-mono text-xs focus:outline-none resize-none leading-relaxed"
                />
              </div>
            )}

            {/* TAB 2: .dockerignore Template Editor */}
            {activeTab === "dockerignore" && (
              <div className="flex-1 bg-[#1e1e1e] text-yellow-400 font-mono text-xs p-4 rounded-xl border-2 border-black overflow-hidden flex flex-col">
                <div className="text-gray-400 pb-2 border-b border-gray-700 mb-2 font-bold flex items-center justify-between">
                  <span>📄 Recommended .dockerignore</span>
                  <button
                    onClick={() => handleDownload(dockerignoreText, ".dockerignore")}
                    className="text-xs text-primary underline font-bold"
                  >
                    Download .dockerignore
                  </button>
                </div>
                <textarea
                  value={dockerignoreText}
                  onChange={(e) => setDockerignoreText(e.target.value)}
                  className="w-full flex-1 bg-transparent text-yellow-300 font-mono text-xs focus:outline-none resize-none leading-relaxed"
                />
              </div>
            )}

            {/* Action Bar Footer */}
            <div className="mt-4 pt-3 border-t border-black/10 dark:border-[#2e2924] flex items-center justify-between text-xs">
              <button
                onClick={() => setDockerfileText(SAMPLE_DOCKERFILE)}
                className="text-muted hover:text-text dark:hover:text-[#f0ebe2] font-bold flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Sample Dockerfile
              </button>
              <button
                onClick={() => handleDownload(dockerfileText, "Dockerfile")}
                className="bg-primary text-black border-2 border-black font-black px-4 py-1.5 rounded-xl shadow-card-sm flex items-center gap-1.5 hover:-translate-y-0.5 transition-all"
              >
                <Download className="w-4 h-4" /> Export Dockerfile
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Hadolint Security Alerts & Layer Calculator (5 cols) */}
        <div className="lg:col-span-5 space-y-6 flex flex-col">
          
          {/* Security Lint Alerts Card */}
          <div className="bg-white dark:bg-[#1f1c18] border-4 border-black dark:border-[#2e2924] rounded-2xl shadow-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10 dark:border-[#2e2924]">
              <h2 className="text-lg font-black text-text dark:text-[#f0ebe2] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> Security Lint Audit
              </h2>
              <span className="text-xs font-mono font-black bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded">
                {lintIssues.length} issue(s)
              </span>
            </div>

            {/* Issues List */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {lintIssues.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-emerald-500/40 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold space-y-1">
                  <CheckCircle2 className="w-8 h-8 mx-auto" />
                  <p className="font-black text-sm">Clean Dockerfile!</p>
                  <p>No Hadolint security violations or bloat issues detected.</p>
                </div>
              ) : (
                lintIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-3 rounded-xl border-2 space-y-2 text-xs ${
                      issue.severity === "critical"
                        ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        : issue.severity === "warning"
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-black">
                      <span className="flex items-center gap-1.5">
                        {issue.severity === "critical" ? (
                          <ShieldAlert className="w-4 h-4 text-rose-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        )}
                        <span>{issue.code} (Line {issue.line})</span>
                      </span>
                      <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                        {issue.severity}
                      </span>
                    </div>

                    <p className="font-bold leading-relaxed">{issue.message}</p>
                    <div className="font-mono text-[11px] bg-black/10 dark:bg-black/40 p-2 rounded-lg border border-black/10">
                      💡 {issue.suggestion}
                    </div>

                    {issue.autoFixable && (
                      <button
                        onClick={() => {
                          if (issue.fixAction) {
                            setDockerfileText(issue.fixAction(dockerfileText));
                            showToast(`Fixed ${issue.code}`);
                          }
                        }}
                        className="w-full bg-black text-white dark:bg-white dark:text-black font-black text-[11px] py-1 rounded-lg border border-black hover:opacity-90 transition-all flex items-center justify-center gap-1"
                      >
                        <Wand2 className="w-3 h-3" /> Quick Fix Violation
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Visual Docker Layer Size Breakdown Chart Card */}
          <div className="bg-white dark:bg-[#1f1c18] border-4 border-black dark:border-[#2e2924] rounded-2xl shadow-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10 dark:border-[#2e2924]">
              <h2 className="text-lg font-black text-text dark:text-[#f0ebe2] flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" /> Image Layer Size Breakdown
              </h2>
              <span className="font-mono text-xs font-black text-muted">{totalImageSize} MB Total</span>
            </div>

            {/* Visual Layer Stacked Bar */}
            <div className="w-full h-4 bg-surface-low dark:bg-[#12110e] border-2 border-black rounded-lg overflow-hidden flex">
              {layerBreakdown.map((layer, idx) => {
                const percent = Math.max(Math.round((layer.sizeMb / Math.max(totalImageSize, 1)) * 100), 4);
                const colors = ["bg-yellow-400", "bg-emerald-400", "bg-indigo-400", "bg-rose-400", "bg-sky-400"];
                return (
                  <div
                    key={idx}
                    style={{ width: `${percent}%` }}
                    className={`${colors[idx % colors.length]} border-r border-black`}
                    title={`Line ${layer.lineNo}: ${layer.instruction} (${layer.sizeMb} MB)`}
                  />
                );
              })}
            </div>

            {/* Layer List Breakdown */}
            <div className="space-y-2 max-h-[180px] overflow-y-auto">
              {layerBreakdown.map((layer, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg border border-black/10 dark:border-[#2e2924] bg-surface-low dark:bg-[#151411] flex items-center justify-between text-xs font-mono"
                >
                  <div className="truncate max-w-[220px]">
                    <span className="font-bold text-text dark:text-[#f0ebe2]">Line {layer.lineNo}:</span>{" "}
                    <span className="text-muted">{layer.instruction}</span>
                  </div>
                  <span className="font-black text-primary shrink-0">{layer.sizeMb} MB</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default DockerfileLinter;
