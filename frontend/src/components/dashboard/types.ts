import type { components } from "../../types/api";
export interface ModuleLesson {
  slug: string;
  title?: string;
  difficulty?: string;
}

export interface ModuleData {
  id: string;
  title: string;
  lessons: ModuleLesson[];
}

export interface GitHubContributor {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface PendingPR {
  id: number;
  created_at: string;
  title: string;
  contributor: string;
  issue_title: string;
}

export interface AssignedIssue {
  id: number;
  points: number;
  title: string;
  description?: string;
  status?: string;
  created_at?: string;
}

export interface SystemStats {
  total_issues: number;
  solved_issues: number;
  open_issues: number;
  in_progress_issues: number;
  total_prs: number;
  merged_prs: number;
  pending_prs: number;
  closed_prs: number;
  active_contributors: number;
}

export interface AdminDashboardData {
  system_stats: SystemStats;
  pending_prs: PendingPR[];
}

export type LeaderboardEntry = components["schemas"]["Leaderboard"];

export type LeaderboardResponse =
  components["schemas"]["PaginatedLeaderboardList"];

export interface PersonalStats {
  issues_solved: number;
  prs_merged: number;
  total_xp: number;
  streak_days: number;
  longest_streak: number;
  rank: number;
  earned_badges: string[];
  available_points?: number;
  unused_freezes?: number;
}

export interface ContributorDashboardData {
  personal_stats: PersonalStats;
  assigned_issues: AssignedIssue[];
}

export interface LearningPathNextStep {
  id: string;
  title: string;
  status: string;
  description: string;
  explanation: string;
  completed_lessons_count: number;
  lessons_count: number;
}

export interface LearningPathData {
  next_step?: LearningPathNextStep | null;
}

export interface CertificateInfo {
  verification_hash?: string;
  issued_at?: string;
}

export interface CertificateResponse {
  has_certificate?: boolean;
  certificate?: CertificateInfo;
}

export interface WeeklyGoalDay {
  day_name: string;
  date: string;
  is_active: boolean;
  is_today: boolean;
  is_future: boolean;
}

export interface WeeklyGoalData {
  id: number;
  week_start_date: string;
  week_end_date: string;
  target_lessons: number;
  target_xp: number;
  target_minutes: number;
  completed_lessons: number;
  earned_xp: number;
  minutes_spent: number;
  lessons_progress_pct: number;
  xp_progress_pct: number;
  minutes_progress_pct: number;
  overall_progress_pct: number;
  daily_breakdown: WeeklyGoalDay[];
}

