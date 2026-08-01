import React, { useState } from "react";
import {
  BookOpen,
  Cpu,
  Database,
  Layers,
  Search,
  Server,
  Shield,
  Sparkles,
  Terminal,
  Code,
  Globe,
  Radio,
  FileCode,
  SlidersHorizontal,
  Key,
  Trophy,
  GitBranch,
  FileText,
  Activity,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";

interface TechComponent {
  name: string;
  category: "frontend" | "backend" | "database" | "async" | "security" | "realtime";
  description: string;
  technologies: string[];
  features: string[];
  endpointOrPath: string;
}

const REPO_FEATURES: TechComponent[] = [
  {
    name: "Interactive Learning & Content Studio",
    category: "frontend",
    description: "Curriculum viewer, interactive quiz runner, markdown renderer, and teacher content draft studio.",
    technologies: ["React", "KaTeX", "Vite", "Django REST"],
    features: ["Step-by-step progress", "Quiz builder & validation", "Live Markdown preview", "XP awards on completion"],
    endpointOrPath: "/learning-path",
  },
  {
    name: "Contributor Sandbox & Code Execution Engine",
    category: "frontend",
    description: "Browser & server-side isolated code execution playground supporting multi-language snippet testing.",
    technologies: ["Monaco Editor", "Web Workers", "Docker", "Pyodide"],
    features: ["Live stdout/stderr capture", "Lint error highlighting", "Theme customization", "Snippet export"],
    endpointOrPath: "/contributor-sandbox",
  },
  {
    name: "Audit Log Inspector & Chronicles",
    category: "security",
    description: "Immutable domain event ledger tracking created, updated, and deleted model snapshots with JSON state diffs.",
    technologies: ["Django Audit Model", "PostgreSQL JSONB", "Tailwind UI"],
    features: ["Before/after state diff", "Search & filter", "Actor & correlation tracking", "CSV/JSON export"],
    endpointOrPath: "/admin/audit",
  },
  {
    name: "Celery Distributed Task Queue",
    category: "async",
    description: "Asynchronous background job worker handling PDF generation, webhook dispatches, and issue quality scans.",
    technologies: ["Celery", "Redis Broker", "WebSocket Push", "Django Monitoring"],
    features: ["Queue depth monitoring", "Worker health gauges", "24h execution sparklines", "Live task triggers"],
    endpointOrPath: "/admin/celery",
  },
  {
    name: "OAuth 2.0 & OpenID Connect Provider",
    category: "security",
    description: "RFC 7636 PKCE compliant OAuth 2.0 authorization server issuing JWT access and refresh tokens to client apps.",
    technologies: ["Django OAuth Toolkit", "SimpleJWT", "PyJWT", "OIDC Provider"],
    features: ["Client Registration", "Public (PKCE) & Confidential types", "Allowed Redirect URIs", "Grant Scopes"],
    endpointOrPath: "/admin/oauth-clients",
  },
  {
    name: "Git Rebase Simulator & PR Diff Summarizer",
    category: "frontend",
    description: "Interactive visualizer for Git branch merging, rebase conflict resolution, and automated PR diff summarization.",
    technologies: ["Git Graph UI", "Mermaid.js", "AI Summarizer"],
    features: ["Interactive graph manipulation", "Step-by-step rebase guide", "Diff highlighting", "Conflict resolution sandbox"],
    endpointOrPath: "/git-rebase-simulator",
  },
  {
    name: "Skill Tree, XP Shop & Leaderboard",
    category: "realtime",
    description: "Gamified learning progression tree with unlockable nodes, XP store rewards, and real-time contributor rankings.",
    technologies: ["Cytoscape.js", "Recharts", "WebSockets"],
    features: ["Interactive node tree", "XP purchase system", "Global rankings", "Streak multiplier calculation"],
    endpointOrPath: "/skill-tree",
  },
  {
    name: "Live Notes, Community Chat & Peer Review",
    category: "realtime",
    description: "Collaborative markdown notebook, real-time community chat channels, and pull request peer review platform.",
    technologies: ["Django Channels", "WebSockets", "Lucide React"],
    features: ["Real-time document sync", "Chat channel switching", "Code review comments", "Notification badges"],
    endpointOrPath: "/collab-notes",
  },
];

const API_ENDPOINTS = [
  { method: "GET", path: "/api/content/lessons/", desc: "List all curriculum modules and lessons" },
  { method: "POST", path: "/api/auth/token/", desc: "Obtain JWT Access & Refresh Token pair" },
  { method: "GET", path: "/api/admin/audit/", desc: "Search & filter domain audit event logs" },
  { method: "GET", path: "/api/admin/celery-stats/", desc: "Fetch live Celery worker & queue metrics" },
  { method: "POST", path: "/api/oauth/clients/", desc: "Register new OAuth 2.0 application client" },
  { method: "GET", path: "/api/leaderboard/", desc: "Retrieve global contributor XP rankings" },
  { method: "GET", path: "/health/", desc: "Comprehensive system component health checks" },
];

export function FullStackDocsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredFeatures = REPO_FEATURES.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.technologies.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = activeCategory === "all" || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-full min-h-screen bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 p-4 md:p-8 flex flex-col gap-8">
      {/* Top Banner */}
      <div className="p-6 md:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-blue-500/20 backdrop-blur-md rounded-2xl text-blue-400 border border-blue-500/30">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Full-Stack Architecture & Feature Directory 📖
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight mt-1">
              Open-Source Atelier Master Docs
            </h1>
            <p className="text-xs md:text-sm text-slate-300 font-medium mt-1 max-w-2xl leading-relaxed">
              Complete interactive documentation covering frontend components, Django backend APIs, Celery task queues, database schemas, OAuth 2.0 security, and repository architecture.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center text-xs font-bold shrink-0">
          <div className="p-3 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="text-xl font-black text-blue-400">30+</div>
            <div className="text-[10px] uppercase text-slate-300">Modules</div>
          </div>
          <div className="p-3 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="text-xl font-black text-emerald-400">100%</div>
            <div className="text-[10px] uppercase text-slate-300">Coverage</div>
          </div>
        </div>
      </div>

      {/* Interactive System Architecture Diagram */}
      <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-3xl flex flex-col gap-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            System Architecture Overview
          </h2>
          <span className="text-xs text-gray-500 font-medium">Click any component to open feature</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Frontend Layer */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
              <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" /> Frontend App Layer
              </span>
              <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-mono font-bold">Vite + React</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-xs">
              Single-page React application powered by Vite, TailwindCSS design tokens, i18n localization, and Zustand/Context state management.
            </p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">React Router 6</span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">Lucide Icons</span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">Monaco Editor</span>
            </div>
          </div>

          {/* Backend API Layer */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
              <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-500" /> Django REST Backend
              </span>
              <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded font-mono font-bold">Python 3.11</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-xs">
              Modular Django REST Framework service providing JWT authentication, Audit Logging, Celery job scheduling, and Spectacular OpenAPI docs.
            </p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">SimpleJWT</span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">Audit Log Engine</span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">OAuth 2.0 OIDC</span>
            </div>
          </div>

          {/* Database & Async Workers */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
              <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-500" /> Async & Database
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">Celery + Redis</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-xs">
              PostgreSQL / SQLite relational datastore paired with Redis for Celery background worker queues and Channels WebSocket event broadcasts.
            </p>
            <div className="flex flex-wrap gap-1 mt-auto">
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">Redis Broker</span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">WebSockets</span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">Task Runs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature & Module Directory Section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Code className="w-6 h-6 text-blue-500" />
              Repository Feature Directory
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              Explore every feature, service worker, and module built into this repository.
            </p>
          </div>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search features or tech..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
              {["all", "frontend", "security", "async", "realtime"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg uppercase text-[10px] tracking-wider transition-all ${
                    activeCategory === cat
                      ? "bg-blue-600 text-white font-bold shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFeatures.map((feat, idx) => (
            <div
              key={idx}
              className="p-5 bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">
                    {feat.name}
                  </h3>
                  <span className="px-2.5 py-0.5 text-[10px] uppercase font-extrabold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    {feat.category}
                  </span>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {feat.description}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {feat.features.map((item, fIdx) => (
                    <span
                      key={fIdx}
                      className="text-[11px] font-medium px-2.5 py-1 bg-slate-100 dark:bg-slate-900 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-1 border border-gray-200 dark:border-slate-800"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
                <div className="flex flex-wrap gap-1 font-mono text-[10px] text-gray-500">
                  {feat.technologies.map((t, tIdx) => (
                    <span key={tIdx} className="bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-800">
                      {t}
                    </span>
                  ))}
                </div>

                <Link
                  to={feat.endpointOrPath}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                >
                  Open Module <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive REST API Catalog */}
      <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-3xl flex flex-col gap-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-500" />
              Core REST & OpenAPI Catalog
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              Principal Django REST Framework API endpoints available in the backend.
            </p>
          </div>

          <a
            href="/api/docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all"
          >
            Open Swagger UI <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-800 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-20">Method</th>
                <th className="py-3 px-4">Endpoint Path</th>
                <th className="py-3 px-4">Description & Contract</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
              {API_ENDPOINTS.map((api, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${
                        api.method === "GET"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {api.method}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                    {api.path}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 font-sans">
                    {api.desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FullStackDocsPage;
