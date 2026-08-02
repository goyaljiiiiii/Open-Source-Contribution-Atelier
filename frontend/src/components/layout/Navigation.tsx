import { useState, useEffect } from "react";
import {
  Activity,
  BookOpen,
  BriefcaseBusiness,
  Cpu,
  Eye,
  FileDiff,
  FileEdit,
  FileText,
  GitBranch,
  GitMerge,
  Key,
  LayoutGrid,
  Menu,
  MessageSquare,
  MessageSquareHeart,
  Radio,
  Search,
  SearchCode,
  Settings,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  Target,
  TerminalSquare,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext";
import { fetchLessonsApi } from "../../lib/lessons";
import api from "../../api";
import LogoutButtonWithConfirm from "./LogoutButtonWithConfirm";
import { SyncStatusIndicator } from "../ui/SyncStatusIndicator";
import { NotificationMenu } from "../ui/NotificationMenu";
import { ThemeToggle } from "../ui/ThemeToggle";
import { useTranslate } from "../../i18n/useTranslate";
import { LessonSearchModal } from "../search/LessonSearchModal";


const navGroups = [
  {
    title: "Curriculum",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { to: "/learning-path", label: "Lessons", icon: BookOpen },
      { to: "/challenges", label: "Challenges", icon: Trophy },
      { to: "/admin/content-studio", label: "Content Studio", icon: FileEdit },
    ],
  },

  {
    title: "Practice",
    items: [
      { to: "/contributor-sandbox", label: "Playground", icon: TerminalSquare },
      { to: "/git-rebase-simulator", label: "Git Rebase", icon: GitBranch },
      { to: "/a11y-sandbox", label: "A11y Sandbox", icon: Eye },
      { to: "/pr-diff-summarizer", label: "PR Summarizer", icon: FileDiff },
      { to: "/bounties", label: "Bounties", icon: Target },
      {
        to: "/good-first-issues",
        label: "Good First Issues",
        icon: SearchCode,
      },
      {
        to: "/tone-coach",
        label: "Tone Coach",
        icon: MessageSquareHeart,
      },
      {
        to: "/conflict-scenario-builder",
        label: "Conflict Builder",
        icon: GitMerge,
      },
    ],
  },
  {
    title: "Progress",
    items: [
      { to: "/skill-tree", label: "Skill Tree", icon: GitBranch },
      { to: "/portfolio", label: "Portfolio", icon: FileText },
      { to: "/leaderboard", label: "Leaderboard", icon: TrendingUp },
      { to: "/shop", label: "XP Shop", icon: ShoppingBag },
    ],
  },
  {
    title: "Collaboration",
    items: [
      { to: "/collab-notes", label: "Live Notes", icon: FileText },
      { to: "/community", label: "Community", icon: BriefcaseBusiness },
      { to: "/chat", label: "Chat", icon: MessageSquare },
      { to: "/peer-review", label: "Peer Review", icon: Shield },
    ],
  },
  {
    title: "Documentation",
    items: [
      { to: "/docs/fullstack", label: "Full-Stack Docs", icon: BookOpen },
      { to: "/docs/env-generator", label: ".env Wizard", icon: SlidersHorizontal },
      { to: "/docs/websocket-simulator", label: "WS Simulator", icon: Activity },
    ],
  },
  {
    title: "Account",
    items: [
      { to: "/profile", label: "Settings", icon: Settings },
      { to: "/settings/webhooks", label: "Webhooks", icon: Radio },
      { to: "/settings/connected-apps", label: "Connected Apps", icon: Shield },
      { to: "/admin/oauth-clients", label: "OAuth Apps", icon: Key },
      { to: "/admin/celery", label: "Celery Tasks", icon: Cpu },
      { to: "/admin/audit", label: "Audit Logs", icon: SlidersHorizontal },
    ],
  },
];

const SITE_FEATURES = [
  { title: "Audit Log Inspector", category: "Admin & Observability", path: "/admin/audit", summary: "Inspect domain audit events, system actions & state diffs." },
  { title: "Celery Task Dashboard", category: "Admin & Observability", path: "/admin/celery", summary: "Monitor worker queues, background tasks & trigger async jobs live." },
  { title: "Full-Stack Documentation", category: "Documentation", path: "/docs/fullstack", summary: "Complete architecture specs, OpenAPI catalog, and repo directory." },
  { title: "OAuth 2.0 Client Apps", category: "Security & Auth", path: "/admin/oauth-clients", summary: "Manage OAuth applications, API keys & test PKCE authorization flow." },
  { title: "Environment Wizard (.env)", category: "Developer Tools", path: "/docs/env-generator", summary: "Generate frontend & backend environment variable files." },
  { title: "WebSocket Simulator", category: "Developer Tools", path: "/docs/websocket-simulator", summary: "Simulate live WebSocket events and channel group broadcasts." },
  { title: "Maintainer Reply Tone Coach", category: "AI & Collaboration", path: "/tone-coach", summary: "Analyze code review reply tone and optimize maintainer feedback with AI." },
  { title: "Git Rebase Visualizer", category: "Git Tools", path: "/git-rebase", summary: "Step-by-step visual git rebase workflow simulator." },
  { title: "Git Bisect Debugging Game", category: "Git Tools", path: "/git-bisect", summary: "Playful interactive game to isolate regression bugs using git bisect." },
  { title: "Git Submodule Simulator", category: "Git Tools", path: "/git-submodules", summary: "Interactive submodule manager and commit tree visualizer." },
  { title: "Git Stash Manager", category: "Git Tools", path: "/git-stash", summary: "Visual git stash stack management sandbox." },
  { title: "Dockerfile Linter", category: "DevOps & CI", path: "/docker-linter", summary: "Lint Dockerfiles against security and multi-stage build best practices." },
  { title: "Monorepo Dependency Visualizer", category: "Architecture", path: "/monorepo-visualizer", summary: "Visualize package graph dependencies in monorepo projects." },
  { title: "Accessibility (A11y) Linter", category: "Frontend Tools", path: "/a11y-sandbox", summary: "WCAG accessibility linter sandbox and element auditor." },
  { title: "PR Diff Summarizer", category: "AI & Collaboration", path: "/pr-diff-summarizer", summary: "Summarize complex pull request diffs using AI." },
  { title: "Contributor Workspace Sandbox", category: "Git Tools", path: "/contributor-sandbox", summary: "Isolated git environment to practice commits and branch pushes." },
  { title: "Live Collaborative Notes", category: "Collaboration", path: "/collab-notes", summary: "Real-time collaborative markdown & code notes with live peer cursors." },
  { title: "Community Chat", category: "Collaboration", path: "/chat", summary: "Real-time group chat rooms and direct contributor messaging." },
  { title: "Community Discussions & Feed", category: "Community", path: "/community", summary: "Ask questions, post code help requests, and join community discussions." },
  { title: "Peer Review Exchange", category: "Community", path: "/peer-review", summary: "Submit code for peer review and provide constructive feedback to peers." },
  { title: "Contributor Leaderboard", category: "Gamification", path: "/leaderboard", summary: "Rankings of open-source contributors based on XP and completed tasks." },
  { title: "XP Shop", category: "Gamification", path: "/shop", summary: "Redeem accumulated XP for badges, custom titles, and profile perks." },
  { title: "Skill Tree Roadmap", category: "Curriculum", path: "/skill-tree", summary: "Interactive skill tree roadmap for open-source mastery." },
  { title: "Learning Pathways", category: "Curriculum", path: "/learning-path", summary: "Structured learning pathways for beginners, contributors, and maintainers." },
  { title: "Open Bounties", category: "Issues & Bounties", path: "/bounties", summary: "Browse open-source issue bounties with XP rewards." },
  { title: "Good First Issue Finder", category: "Issues & Bounties", path: "/good-first-issues", summary: "Curated beginner-friendly GitHub issues ready for contribution." },
  { title: "Interactive Challenges", category: "Interactive Games", path: "/challenges", summary: "Solve interactive git & open-source contribution challenges." },
  { title: "Profile & Account Settings", category: "Account", path: "/profile", summary: "User profile settings, avatar, notification preferences & billing." },
  { title: "Webhook Subscriptions", category: "Account", path: "/settings/webhooks", summary: "Manage outgoing webhook endpoints and HMAC signatures." },
  { title: "Connected Applications", category: "Account", path: "/settings/connected-apps", summary: "Manage third-party integrations and GitHub OAuth connections." },
  { title: "API Performance Dashboard", category: "Admin & Observability", path: "/admin/performance", summary: "Inspect API latency metrics, endpoint throughput, and slow queries." },
  { title: "Vulnerability Scanner", category: "Admin & Observability", path: "/admin/vulnerabilities", summary: "Security vulnerability audit dashboard and dependency alerts." },
];

export function Navigation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    features: { title: string; category: string; path: string; summary: string }[];
    lessons: {
      slug: string;
      title: string;
      description: string;
      summary: string;
    }[];
    challenges: { slug: string; title: string; summary: string }[];
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lessonsCatalog, setLessonsCatalog] = useState<
    { slug: string; title: string; description: string }[]
  >([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isFullSearchOpen, setIsFullSearchOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsFullSearchOpen(true);
    window.addEventListener("open-lesson-search", handleOpen);
    return () => window.removeEventListener("open-lesson-search", handleOpen);
  }, []);

  useEffect(() => {
    fetchLessonsApi().then((data) => setLessonsCatalog(data));
  }, []);


  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 1) {
        setIsSearching(true);
        const query = searchQuery.toLowerCase();

        const filteredFeatures = SITE_FEATURES.filter(
          (feat) =>
            feat.title.toLowerCase().includes(query) ||
            feat.category.toLowerCase().includes(query) ||
            feat.summary.toLowerCase().includes(query) ||
            feat.path.toLowerCase().includes(query)
        );

        const filteredLessons = lessonsCatalog.filter(
          (lesson) =>
            lesson.title.toLowerCase().includes(query) ||
            lesson.description.toLowerCase().includes(query),
        );

        const mockChallenges = [
          {
            title: "Hacktoberfest Warmup",
            summary:
              "Guide contributors through issue triage, branch naming, and clean commits.",
            slug: "hacktoberfest-warmup",
          },
          {
            title: "Git Recovery Lab",
            summary:
              "Practice safe undo flows, rebases, and fixing a messy working tree.",
            slug: "git-recovery-lab",
          },
        ];
        const filteredChallenges = mockChallenges.filter(
          (ch) =>
            ch.title.toLowerCase().includes(query) ||
            ch.summary.toLowerCase().includes(query),
        );

        const results = {
          features: filteredFeatures,
          lessons: filteredLessons.map((l) => ({
            ...l,
            summary: l.description,
          })),
          challenges: filteredChallenges,
        };
        setSearchResults(results);
        setIsSearching(false);

        const totalResults = results.lessons.length + results.challenges.length;
        api
          .post("/search/track/", { query, result_count: totalResults })
          .catch(() => {});
      } else {
        setSearchResults(null);
      }
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, lessonsCatalog]);

  return (
    <>
      <aside
        aria-label="Main sidebar"
        className="fixed inset-y-0 left-0 z-40 hidden w-[240px] border-r-4 border-black bg-surface-lowest/95 backdrop-blur-xl lg:flex lg:flex-col dark:bg-[#0f0e0c]/95 dark:border-[#2e2924]"
      >
        <div className="flex h-[72px] flex-col justify-center border-b-4 border-black px-6 dark:border-[#2e2924]">
          <Link
            to="/"
            className="block font-display text-xl font-black tracking-tight text-black dark:text-white uppercase"
          >
            Atelier
          </Link>
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-muted dark:text-[#9b8f80]">
            Contribution Console
          </span>
        </div>

        <nav
          aria-label="Sidebar navigation"
          className="flex-1 px-3 py-4 overflow-y-auto space-y-4"
        >
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <h3 className="px-3 text-[10px] font-mono uppercase tracking-[0.2em] text-muted/65 dark:text-[#9b8f80]/65">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      className={({ isActive }) =>
                        [
                          "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 border-2",
                          isActive
                            ? "bg-[#C3C0FF]/25 border-black dark:border-[#2e2924] text-text shadow-card-sm dark:text-[#f0ebe2]"
                            : "border-transparent text-muted hover:bg-surface-low hover:text-text dark:text-[#c4bbae] dark:hover:bg-[#151411] dark:hover:text-[#f0ebe2]",
                        ].join(" ")
                      }
                    >
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t-4 border-black px-4 py-3 text-xs text-muted dark:border-[#2e2924] dark:text-slate-200">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Shield size={14} />
            <span>Community Safe Mode</span>
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 h-[72px] border-b-4 border-black bg-white lg:left-[240px] dark:border-[#2e2924] dark:bg-[#0f0e0c]">
        <div className="flex h-full items-center justify-between gap-2 px-3 sm:px-6 lg:px-8 max-w-full overflow-hidden">
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden rounded-lg border-2 border-black p-2 menu-btn bg-white dark:bg-[#151411] dark:border-[#2e2924]"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close mobile menu" : "Open mobile menu"}
              aria-controls="mobile-menu"
            >
              <Menu size={18} />
            </button>
            <Link
              to="/"
              className="lg:hidden font-display text-base sm:text-lg font-black tracking-tight text-black dark:text-white uppercase shrink-0"
            >
              Atelier
            </Link>
          </div>

          {/* Desktop Search bar input container */}
          <div className="hidden lg:flex min-w-0 items-center space-x-2 relative grow max-w-md">
            <div
              onClick={() => setIsFullSearchOpen(true)}
              className="flex items-center space-x-2 rounded-lg bg-surface-low px-3 py-2 text-muted w-full border-2 border-black dark:border-[#2e2924] shadow-card-sm focus-within:bg-white transition-all dark:bg-[#151411] dark:text-slate-200 cursor-pointer"
            >
              <label htmlFor="nav-search-input" className="sr-only">
                Search features, tools, lessons, pages
              </label>
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                id="nav-search-input"
                type="text"
                readOnly
                placeholder="Search lessons & tools... (Cmd+K)"
                className="bg-transparent border-none outline-none text-sm w-full text-text placeholder:text-muted/75 dark:text-[#f0ebe2] cursor-pointer"
                onClick={() => setIsFullSearchOpen(true)}
              />
              <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono font-bold bg-white dark:bg-[#2e2924] border border-black/20 dark:border-white/20 px-1.5 py-0.5 rounded text-muted dark:text-slate-300">
                ⌘K
              </span>
            </div>

            {/* Desktop Search Results Dropdown */}
            {searchResults && searchQuery.length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border-4 border-black rounded-2xl shadow-card p-4 z-50 max-h-[70vh] overflow-y-auto dark:bg-[#151411] dark:border-[#2e2924]">
                {isSearching ? (
                  <p className="text-sm text-muted animate-pulse dark:text-[#c4bbae]">
                    Searching features &amp; lessons...
                  </p>
                ) : (
                  <div className="space-y-6">
                    {searchResults.features && searchResults.features.length > 0 && (
                      <div>
                        <h4 className="font-mono text-[10px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2 font-bold flex items-center justify-between">
                          <span>🛠️ Features &amp; Tools</span>
                          <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                            {searchResults.features.length} found
                          </span>
                        </h4>
                        <div className="space-y-1.5">
                          {searchResults.features.map((feat) => (
                            <Link
                              key={feat.path}
                              to={feat.path}
                              onClick={() => setSearchQuery("")}
                              className="block p-2 rounded-xl hover:bg-indigo-50/80 dark:hover:bg-[#1f1c18] border border-transparent hover:border-indigo-200 dark:hover:border-indigo-900/40 transition group"
                            >
                              <div className="flex items-center justify-between">
                                <p className="font-bold text-sm text-gray-900 dark:text-[#f0ebe2] group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                  {feat.title}
                                </p>
                                <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                                  {feat.category}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-[#c4bbae] truncate mt-0.5">
                                {feat.summary}
                              </p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.lessons.length > 0 && (
                      <div>
                        <h4 className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2 font-bold">
                          📚 Lessons &amp; Content
                        </h4>
                        <div className="space-y-1.5">
                          {searchResults.lessons.map((lesson) => (
                            <Link
                              key={lesson.slug}
                              to={`/lessons/${lesson.slug}`}
                              onClick={() => setSearchQuery("")}
                              className="block p-2 rounded-xl hover:bg-surface-low transition group dark:hover:bg-[#1f1c18]"
                            >
                              <p className="font-bold text-sm group-hover:text-primary dark:text-[#f0ebe2]">
                                {lesson.title}
                              </p>
                              <p className="text-xs text-muted truncate dark:text-[#c4bbae]">
                                {lesson.summary}
                              </p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {searchResults.challenges.length > 0 && (
                      <div>
                        <h4 className="font-mono text-[10px] uppercase tracking-widest text-accent mb-2 font-bold">
                          🎯 Issues &amp; Challenges
                        </h4>
                        <div className="space-y-1.5">
                          {searchResults.challenges.map((challenge) => (
                            <Link
                              key={challenge.slug}
                              to="/challenges"
                              onClick={() => setSearchQuery("")}
                              className="block p-2 rounded-xl hover:bg-surface-low transition group dark:hover:bg-[#1f1c18]"
                            >
                              <p className="font-bold text-sm group-hover:text-accent dark:text-[#f0ebe2]">
                                {challenge.title}
                              </p>
                              <p className="text-xs text-muted truncate dark:text-[#c4bbae]">
                                {challenge.summary}
                              </p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {searchResults.features.length === 0 &&
                      searchResults.lessons.length === 0 &&
                      searchResults.challenges.length === 0 && (
                        <p className="text-sm text-muted italic dark:text-[#c4bbae] py-2 text-center">
                          No matching features, tools or lessons found.
                        </p>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
            {/* Mobile Search Toggle Button */}
            <button
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className="lg:hidden p-2 rounded-lg border-2 border-black bg-white dark:bg-[#151411] dark:border-[#2e2924] text-text dark:text-[#f0ebe2]"
              aria-label="Toggle mobile search"
            >
              <Search size={18} />
            </button>

            <Link
              to="/docs/fullstack"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <BookOpen size={14} /> Full-Stack Docs
            </Link>
            <SyncStatusIndicator />
            <ThemeToggle />
            {user && !user.is_staff && <NotificationMenu />}
            {user ? (
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <Link
                  to="/profile"
                  className="font-bold text-xs sm:text-sm text-text bg-white px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border-2 border-black dark:bg-[#151411] dark:text-[#f0ebe2] dark:border-[#2e2924] flex items-center gap-1.5 shadow-card-sm hover:bg-surface-low transition-colors dark:hover:bg-[#1f1c18]"
                  title="Profile Settings"
                >
                  👤{" "}
                  <span className="hidden sm:inline-block max-w-[80px] truncate">{user.username}</span>
                  {user.is_staff && (
                    <span className="font-black text-[9px] bg-[#ff665c] text-white px-1.5 py-0.5 rounded border border-black dark:border-none">
                      ADMIN
                    </span>
                  )}
                </Link>
                <LogoutButtonWithConfirm />
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="rounded-xl bg-white border-2 border-black px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold text-text shadow-card-sm hover:-translate-y-0.5 active:translate-y-0 transition-all dark:bg-[#151411] dark:text-[#f0ebe2] dark:border-[#2e2924]"
                >
                  {t('nav.login', {defaultValue: 'Log In'})}
                </Link>
                <Link
                  to="/signup"
                  className="rounded-xl bg-[#C3C0FF] border-2 border-black px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-black text-black shadow-card-sm hover:-translate-y-0.5 active:translate-y-0 transition-all dark:bg-[#C3C0FF] dark:border-white"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Search Overlay Bar */}
        {mobileSearchOpen && (
          <div className="lg:hidden border-t-2 border-black dark:border-[#2e2924] bg-white dark:bg-[#151411] p-3 shadow-lg flex items-center gap-2">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search features, tools, lessons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full text-text dark:text-[#f0ebe2]"
              autoFocus
            />
            <button
              onClick={() => {
                setSearchQuery("");
                setMobileSearchOpen(false);
              }}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#2e2924]"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setMobileOpen(false)}
          aria-hidden="true"
        >
          <div
            id="mobile-menu"
            className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-[#151411] flex flex-col shadow-2xl border-r-4 border-black dark:border-[#2e2924]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b-4 border-black dark:border-[#2e2924]">
              <div className="flex flex-col">
                <span className="font-black text-lg uppercase tracking-tight text-black dark:text-white">
                  Atelier
                </span>
                <span className="text-[10px] font-mono text-muted dark:text-[#9b8f80]">
                  Contribution Console
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg border-2 border-black dark:border-[#2e2924] hover:bg-gray-100 dark:hover:bg-[#1f1c18]"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Nav Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-24">
              {navGroups.map((group) => (
                <div key={group.title} className="space-y-1">
                  <h3 className="px-3 text-[10px] font-mono uppercase tracking-[0.2em] text-muted/65 dark:text-[#9b8f80]/65 font-bold">
                    {group.title}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            [
                              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all border-2",
                              isActive
                                ? "bg-[#C3C0FF]/25 border-black dark:border-[#2e2924] text-text dark:text-[#f0ebe2] shadow-card-sm"
                                : "border-transparent text-muted hover:bg-gray-100 dark:hover:bg-[#1f1c18] dark:text-[#c4bbae]",
                            ].join(" ")
                          }
                        >
                          <Icon size={16} />
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <LessonSearchModal
        isOpen={isFullSearchOpen}
        onClose={() => setIsFullSearchOpen(false)}
      />
    </>
  );
}

export default Navigation;
