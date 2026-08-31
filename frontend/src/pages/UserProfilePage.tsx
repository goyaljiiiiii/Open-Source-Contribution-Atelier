import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchApi, getMediaUrl } from "../lib/api";
import { StreakFlameBadge } from "../components/ui/StreakFlameBadge";
import { ShareProfileModal } from "../components/ui/ShareProfileModal";
import { ProfileSettingsForm } from "../features/auth/ProfileSettingsForm";
import { TwoFactorSetupSection } from "../features/auth/TwoFactorSetupSection";
import { NotificationPrefsToggle } from "../components/ui/NotificationPrefsToggle";
import { useAuth } from "../features/auth/AuthContext";
import {
  Github,
  Linkedin,
  Twitter,
  Award,
  BookOpen,
  Calendar,
  MapPin,
  Copy,
  Check,
  Trophy,
  TrendingUp,
  Share2,
  Settings,
  Sparkles,
  UserCheck,
  Shield,
  Layers,
  Activity,
  Flame,
  ExternalLink,
  Edit3,
  Image as ImageIcon,
} from "lucide-react";

interface UserProfileData {
  user: {
    id: number;
    username: string;
    email: string;
    is_staff: boolean;
    avatar_url: string | null;
    cover_image_url: string | null;
    timezone: string;
    twitter_url: string;
    linkedin_url: string;
    github_url: string;
    bio?: string;
  };
  badges: Array<{
    id: number;
    earned_at: string;
    badge: {
      name: string;
      description: string;
      icon_url?: string;
      slug: string;
    };
  }>;
  total_score: number;
  completed_lessons: number;
  global_rank?: number;
  percentile_standing?: number;
  rank_tier?: string;
  streak_days?: number;
  longest_streak?: number;
}

const BANNER_PRESETS = [
  {
    id: "preset:cyberpunk",
    name: "Cyberpunk",
    style: "bg-gradient-to-r from-slate-950 via-purple-950 to-indigo-950",
  },
  {
    id: "preset:aurora",
    name: "Aurora Glow",
    style: "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600",
  },
  {
    id: "preset:emerald",
    name: "Matrix Emerald",
    style: "bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-950",
  },
  {
    id: "preset:sunset",
    name: "Sunset Neon",
    style: "bg-gradient-to-r from-orange-600 via-rose-600 to-purple-700",
  },
  {
    id: "preset:obsidian",
    name: "Obsidian Grid",
    style: "bg-gradient-to-r from-zinc-900 via-neutral-900 to-slate-900",
  },
];

export function UserProfilePage() {
  const { username: paramUsername } = useParams<{ username: string }>();
  let currentUser = null;
  let checkUser = async () => {};

  try {
    const auth = useAuth();
    currentUser = auth.user;
    checkUser = auth.checkUser;
  } catch {
    // Fallback for isolated unit tests without AuthProvider wrapper
  }

  const activeUsername = paramUsername || currentUser?.username || "";
  const isOwner =
    Boolean(currentUser?.username) &&
    (!paramUsername || paramUsername.toLowerCase() === currentUser?.username.toLowerCase());

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "badges" | "activity" | "settings">(
    "overview",
  );

  const getPercentileLabel = (standing?: number, score: number = 0) => {
    if (standing !== undefined && standing !== null) {
      return `Top ${standing}% Contributor`;
    }
    if (score >= 1000) return "Top 5% Contributor";
    if (score >= 500) return "Top 10% Contributor";
    if (score >= 100) return "Top 25% Contributor";
    return "Top 50% Contributor";
  };

  const handleCopyLink = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    const linkTarget = activeUsername ? activeUsername : "user";
    const profileLink = `${window.location.origin}/u/${encodeURIComponent(linkTarget)}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        void navigator.clipboard.writeText(profileLink);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = profileLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
    } catch {
      // Ignored clipboard error
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!activeUsername) {
        setLoading(false);
        setError("User profile not specified.");
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await fetchApi(
          `/accounts/profile/${encodeURIComponent(activeUsername)}/`,
          { requireAuth: false },
        );
        setProfile(data);
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to load profile.";
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [activeUsername]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 dark:bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Loading Profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 bg-slate-50 dark:bg-[#0a0a0f]">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:bg-[#121218] dark:border-slate-800">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
            Profile Not Found
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">
            {error || "The user profile you are looking for does not exist or has been moved."}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition-all text-xs"
          >
            Go Back Home
          </Link>
        </div>
      </div>
    );
  }

  const { user, badges, total_score, completed_lessons } = profile;

  const renderBannerContent = () => {
    const coverUrl = user.cover_image_url;
    if (coverUrl && coverUrl.startsWith("preset:")) {
      const preset = BANNER_PRESETS.find((p) => p.id === coverUrl);
      return preset?.style || BANNER_PRESETS[0].style;
    }
    if (coverUrl && !coverUrl.startsWith("preset:")) {
      return null;
    }
    return BANNER_PRESETS[0].style;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090e] pb-16 transition-colors">
      {/* 1. HERO COVER BANNER */}
      <div className="relative w-full h-44 sm:h-56 md:h-64 overflow-hidden shadow-inner">
        {user.cover_image_url && !user.cover_image_url.startsWith("preset:") ? (
          <img
            src={getMediaUrl(user.cover_image_url) || ""}
            alt={`${user.username}'s cover banner`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full ${renderBannerContent()} relative`}>
            {/* SVG GRID OVERLAY PATTERN */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          </div>
        )}

        {/* QUICK SHARE OVERLAY BUTTON ON BANNER */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-10">
          <button
            onClick={() => setShareModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-white border border-white/20 text-xs font-bold backdrop-blur-md transition-all shadow-lg hover:scale-105"
          >
            <Share2 size={14} />
            <span className="hidden sm:inline">Share</span>
          </button>
          {isOwner && (
            <button
              onClick={() => setActiveTab("settings")}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white border border-indigo-400/30 text-xs font-bold backdrop-blur-md transition-all shadow-lg hover:scale-105"
            >
              <Settings size={14} />
              <span className="hidden sm:inline">Edit Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. PROFILE CONTAINER & MAIN CARD */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-20 mb-8 rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-xl dark:border-slate-800 dark:bg-[#12121c]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            {/* AVATAR + BASIC DETAILS */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
              {/* AVATAR WRAPPER */}
              <div className="relative group shrink-0">
                <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl border-4 border-white dark:border-[#12121c] bg-slate-100 dark:bg-[#1c1c28] overflow-hidden shadow-2xl flex items-center justify-center">
                  {user.avatar_url ? (
                    <img
                      src={getMediaUrl(user.avatar_url) || ""}
                      alt={user.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-black uppercase text-indigo-600 dark:text-indigo-400">
                      {user.username.charAt(0)}
                    </span>
                  )}
                </div>

                {/* ONLINE STATUS BADGE */}
                <div
                  className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-white dark:border-[#12121c] bg-emerald-500 shadow-md"
                  title="Active Open Source Contributor"
                />
              </div>

              {/* USERNAME & BADGES */}
              <div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {user.username}
                  </h1>

                  {user.is_staff && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-900 text-white dark:bg-white dark:text-slate-900 tracking-wider">
                      Staff
                    </span>
                  )}
                </div>

                {/* RANK PERCENTILE BADGE */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-3">
                  <span
                    data-testid="rank-percentile-badge"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-sm"
                  >
                    <Trophy size={13} className="stroke-[2.5]" />
                    {getPercentileLabel(profile.percentile_standing, total_score)}
                  </span>
                </div>

                {/* METADATA (JOINED, TIMEZONE) */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-slate-400" />
                    <span>
                      Joined{" "}
                      {new Date(
                        user.timezone
                          ? new Date().toLocaleString("en-US", { timeZone: user.timezone })
                          : new Date(),
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {user.timezone && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-400" />
                      <span>{user.timezone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS (SHARE PROFILE & COPY LINK) */}
            <div className="flex items-center justify-center sm:justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  handleCopyLink(e);
                  setShareModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all hover:scale-105 active:scale-95"
              >
                <Share2 size={14} />
                <span>{copied ? "Copied Link!" : "Share Profile"}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                title="Copy direct profile link"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy Direct Link"}</span>
              </button>
            </div>
          </div>

          {/* SOCIAL LINKS ROW */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide mr-2">
              Connect:
            </span>
            {user.github_url ? (
              <a
                href={user.github_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub Profile"
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-900 hover:text-white dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-white dark:hover:text-black transition-all"
              >
                <Github size={16} />
              </a>
            ) : null}
            {user.linkedin_url ? (
              <a
                href={user.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn Profile"
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#0A66C2] hover:text-white dark:border-slate-800 dark:bg-slate-800/50 transition-all"
              >
                <Linkedin size={16} />
              </a>
            ) : null}
            {user.twitter_url ? (
              <a
                href={user.twitter_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter Profile"
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#1DA1F2] hover:text-white dark:border-slate-800 dark:bg-slate-800/50 transition-all"
              >
                <Twitter size={16} />
              </a>
            ) : null}
            {!user.github_url && !user.linkedin_url && !user.twitter_url && (
              <span className="text-xs font-semibold text-slate-400 italic">
                No social profiles added yet.
              </span>
            )}
          </div>
        </div>

        {/* 3. KEY METRICS STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* STREAK CARD */}
          <div className="rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-50/80 to-amber-50/50 p-4 dark:border-orange-900/30 dark:from-orange-950/20 dark:to-amber-950/10">
            <div className="flex items-center gap-3">
              <StreakFlameBadge
                streakDays={profile.streak_days ?? 0}
                longestStreak={profile.longest_streak ?? 0}
                size={34}
              />
              <div>
                <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                  {profile.streak_days ?? 0} Days
                </div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Best: {profile.longest_streak ?? profile.streak_days ?? 0} d
                </div>
              </div>
            </div>
          </div>

          {/* COMPLETED LESSONS CARD */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-[#12121c]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <BookOpen size={20} />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                  {completed_lessons}
                </div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Lessons Completed
                </div>
              </div>
            </div>
          </div>

          {/* TOTAL XP CARD */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-[#12121c]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                <Award size={20} />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                  {total_score}
                </div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  XP Points
                </div>
              </div>
            </div>
          </div>

          {/* GLOBAL RANK STANDING CARD */}
          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-yellow-50/40 p-4 dark:border-amber-900/30 dark:from-amber-950/20 dark:to-yellow-950/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <TrendingUp size={20} />
              </div>
              <div>
                <div className="text-xl font-black text-amber-700 dark:text-amber-400 leading-tight">
                  Top {profile.percentile_standing ?? 5}%
                </div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Global Rank Standing
                </div>
              </div>
          </div>
        </div>
      </div>

        {/* 4. NAVIGATION TABS */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-extrabold border-b-2 transition-all shrink-0 ${
              activeTab === "overview"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <UserCheck size={16} /> Overview
          </button>

          <button
            onClick={() => setActiveTab("badges")}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-extrabold border-b-2 transition-all shrink-0 ${
              activeTab === "badges"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Trophy size={16} /> Badges & Trophies ({badges.length})
          </button>

          <button
            onClick={() => setActiveTab("activity")}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-extrabold border-b-2 transition-all shrink-0 ${
              activeTab === "activity"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Activity size={16} /> Activity & Stats
          </button>

          {isOwner && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-extrabold border-b-2 transition-all shrink-0 ml-auto ${
                activeTab === "settings"
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Settings size={16} /> Settings & Preferences
            </button>
          )}
        </div>

        {/* 5. TAB CONTENT PANELS */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* MAIN BIO & ACHIEVEMENTS */}
            <div className="lg:col-span-2 space-y-6">
              {/* ABOUT ME SECTION */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#12121c]">
                <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 dark:text-white mb-3">
                  About Me
                </h3>
                <p className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                  {user.bio ||
                    "This open source contributor hasn't added a custom bio yet, but is actively completing modules & merging code!"}
                </p>
              </div>

              {/* ACHIEVEMENTS / BADGES SUMMARY */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#12121c]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                    Achievements & Badges
                  </h3>
                  {badges.length > 0 && (
                    <button
                      onClick={() => setActiveTab("badges")}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      View All ({badges.length}) →
                    </button>
                  )}
                </div>

                {badges.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {badges.slice(0, 4).map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center gap-3.5 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-[#1a1a26]"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-2xl">
                          🏅
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            {b.badge.name}
                          </h4>
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 line-clamp-1">
                            {b.badge.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center bg-slate-50 dark:bg-[#181824] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <span className="text-3xl">🌟</span>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2">
                      No badges earned yet. Keep solving challenges to unlock badges!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT WIDGET: GLOBAL RANKING DETAILS */}
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#12121c]">
                <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 dark:text-white mb-4">
                  Statistics & Global Rank
                </h3>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 text-center">
                    <div className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide">
                      Global Standing: Top{" "}
                      {profile.percentile_standing ??
                        (total_score >= 1000
                          ? 5
                          : total_score >= 500
                          ? 10
                          : total_score >= 100
                          ? 25
                          : 50)}
                      %
                    </div>
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-1">
                      Calculated against all active open source contributors
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#1a1a26]">
                      <div className="text-lg font-black text-slate-900 dark:text-white">
                        {completed_lessons} Done
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Modules</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#1a1a26]">
                      <div className="text-lg font-black text-slate-900 dark:text-white">
                        {total_score} XP
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Points</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: BADGES */}
        {activeTab === "badges" && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#12121c]">
            <h3 className="text-lg font-black uppercase text-slate-900 dark:text-white mb-6">
              All Earned Badges & Trophies ({badges.length})
            </h3>
            {badges.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {badges.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-[#181826]"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 text-3xl shadow-sm">
                      🏅
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {b.badge.name}
                      </h4>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                        {b.badge.description}
                      </p>
                      <span className="inline-block mt-2 text-[10px] font-extrabold text-slate-400 uppercase">
                        Earned: {new Date(b.earned_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <span className="text-4xl">🏆</span>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-2">
                  No badges unlocked yet. Start completing challenges to earn your first badge!
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB: ACTIVITY */}
        {activeTab === "activity" && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#12121c]">
            <h3 className="text-lg font-black uppercase text-slate-900 dark:text-white mb-4">
              Contribution & Learning History
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Track your open source progress, streak milestones, and completed learning modules.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#181826]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400 font-black">
                  <Flame size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    {profile.streak_days ?? 0} Day Active Contribution Streak
                  </h4>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Highest streak recorded: {profile.longest_streak ?? profile.streak_days ?? 0} days
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: SETTINGS & PREFERENCES (FOR OWNER) */}
        {activeTab === "settings" && isOwner && (
          <div className="space-y-8">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-[#12121c]">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-xl font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
                    <Settings size={20} className="text-indigo-600 dark:text-indigo-400" />
                    Account & Profile Settings
                  </h2>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                    Update your public profile, cover banner, bio, and security preferences
                  </p>
                </div>
              </div>

              {/* COMPACT SETTINGS FORM */}
              <ProfileSettingsForm onChange={() => checkUser()} />
            </div>

            <TwoFactorSetupSection />
          </div>
        )}
      </div>

      {/* SHARE PROFILE MODAL */}
      <ShareProfileModal
        username={user.username}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        bio={user.bio}
        avatarUrl={user.avatar_url ? getMediaUrl(user.avatar_url) : null}
      />
    </div>
  );
}

export default UserProfilePage;
