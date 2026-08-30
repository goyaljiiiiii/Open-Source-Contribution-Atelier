import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { PublicLayout } from "../components/layout/PublicLayout";
import { GitTerminal } from "../components/ui/GitTerminal";
import SkeletonLesson from "../components/ui/skeletons/SkeletonLesson";
import { TerminalReplay } from "../components/ui/TerminalReplay";
import { useAuth } from "../features/auth/AuthContext";
import { RouteSuspenseWrapper } from "../components/ui/SkeletonRegistry";

import {
  FullStackDocsPage,
  ChallengePage,
  A11yLinterSandbox,
  ChatPage,
  CommunityPage,
  DashboardPage,
  GitHubAuthCallbackPage,

  LoginPage,
  SignupPage,
  LessonPage,
  LessonCollaboratePage,
  NotFoundPage,
  ServerErrorPage,
  ModerationDashboard,
  BackupDashboardPage,
  AuditLogViewerPage,
  CeleryDashboardPage,
  ApiPerformanceDashboardPage,
  VulnerabilityDashboard,
  SecurityDashboardPage,
  SandboxPage,
  ContributorSandboxPage,
  GitSubmoduleSimulatorPage,
  GitStashManagerPage,
  GitRebaseVisualizerPage,
  MonorepoVisualizerPage,
  DockerfileLinterPage,
  GitBisectGamePage,
  CollabSessionPage,
  CollabNotesPage,
  PrDiffSummarizerPage,
  ProfileSettingsPage,
  NotificationPreferencesPage,
  DigestPage,
  PricingPage,
  BillingPage,
  InvoiceHistoryPage,
  WebhookSettingsPage,
  UserProfilePage,
  LeaderboardPage,
  ShopPage,
  VerifyCertificatePage,
  PeerReviewPage,
  PathwayPage,
  SkillTreePage,
  LearningPathPage,
  BountiesPage,
  GoodFirstIssueFinderPage,
  MaintainerReplyToneCoachPage,
  MergeConflictScenarioBuilderPage,
  PerformanceDashboardPage,
  ContentStudioPage,
  QuizBuilderPage,
  ModuleTreePage,
  AnalyticsDashboardPage,
  TemplateMarketplacePage,
  PortfolioPage,
  ApiDocsPage,
  EnvConfigGeneratorPage,
  WebSocketSimulatorPage,
  OAuthClientsPage,
  UsageAnalyticsPage,
  ConnectedAppsPage,
  GitBranchSimulatorPage,
} from "./routeComponents";

function RouteLoadingFallback() {
  return (
    <div
      className="flex min-h-screen w-full items-center justify-center"
      aria-busy="true"
      aria-label="Loading page"
      role="status"
    >
      <div className="w-full max-w-3xl px-4">
        <SkeletonLesson />
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <RouteLoadingFallback />;
  }

  if (!isAuthenticated) {
    const wasLoggedOut = sessionStorage.getItem("userLoggedOut") === "true";
    sessionStorage.removeItem("userLoggedOut");
    return (
      <Navigate to={wasLoggedOut ? "/login" : "/login?expired=true"} replace />
    );
  }

  return <RouteSuspenseWrapper>{children}</RouteSuspenseWrapper>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <RouteLoadingFallback />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <RouteSuspenseWrapper>{children}</RouteSuspenseWrapper>;
}

export function AppRouter() {
  return (
    <Routes>
      {/* Public Routes with Animation Layout */}
      <Route element={<PublicLayout />}>
        {/* Standalone Route without AppLayout (No Navbar) */}
        <Route
          path="/"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />

        <Route
          path="/auth/github/callback"
          element={
            <RouteSuspenseWrapper>
              <GitHubAuthCallbackPage />
            </RouteSuspenseWrapper>
          }
        />

        {/* Public auth routes */}
        <Route
          path="/login"
          element={
            <RouteSuspenseWrapper>
              <LoginPage />
            </RouteSuspenseWrapper>
          }
        />
        <Route
          path="/signup"
          element={
            <RouteSuspenseWrapper>
              <SignupPage />
            </RouteSuspenseWrapper>
          }
        />
        <Route
          path="/verify"
          element={
            <RouteSuspenseWrapper>
              <VerifyCertificatePage />
            </RouteSuspenseWrapper>
          }
        />
        <Route
          path="/verify/:hash"
          element={
            <RouteSuspenseWrapper>
              <VerifyCertificatePage />
            </RouteSuspenseWrapper>
          }
        />

        <Route
          path="/500"
          element={
            <RouteSuspenseWrapper>
              <ServerErrorPage />
            </RouteSuspenseWrapper>
          }
        />

        <Route
          path="*"
          element={
            <RouteSuspenseWrapper>
              <NotFoundPage />
            </RouteSuspenseWrapper>
          }
        />
      </Route>

      {/* Authenticated Routes with Navbar Layout */}
      <Route element={<AppLayout />}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pathway"
          element={
            <ProtectedRoute>
              <PathwayPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/docs/fullstack"
          element={
            <ProtectedRoute>
              <FullStackDocsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documentation"
          element={
            <ProtectedRoute>
              <FullStackDocsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/learning-path"
          element={
            <ProtectedRoute>
              <LearningPathPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/lessons/:slug"
          element={
            <ProtectedRoute>
              <LessonPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/lessons/:slug/collaborate"
          element={
            <ProtectedRoute>
              <LessonCollaboratePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat/:roomId?"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/a11y-sandbox"
          element={
            <ProtectedRoute>
              <A11yLinterSandbox />
            </ProtectedRoute>
          }
        />

        <Route
          path="/challenges"
          element={
            <ProtectedRoute>
              <ChallengePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/bounties"
          element={
            <ProtectedRoute>
              <BountiesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/good-first-issues"
          element={
            <ProtectedRoute>
              <GoodFirstIssueFinderPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tone-coach"
          element={
            <ProtectedRoute>
              <MaintainerReplyToneCoachPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/conflict-scenario-builder"
          element={
            <ProtectedRoute>
              <MergeConflictScenarioBuilderPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/community"
          element={
            <ProtectedRoute>
              <CommunityPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/sandbox"
          element={
            <ProtectedRoute>
              <SandboxPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/contributor-sandbox"
          element={
            <ProtectedRoute>
              <ContributorSandboxPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/sandbox/submodules"
          element={
            <ProtectedRoute>
              <GitSubmoduleSimulatorPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/sandbox/branches"
          element={
            <ProtectedRoute>
              <GitBranchSimulatorPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/git-tools/stash"
          element={
            <ProtectedRoute>
              <GitStashManagerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/git-rebase-simulator"
          element={
            <ProtectedRoute>
              <GitRebaseVisualizerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/monorepo-visualizer"
          element={
            <ProtectedRoute>
              <MonorepoVisualizerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/skill-tree"
          element={
            <ProtectedRoute>
              <SkillTreePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/skills"
          element={
            <ProtectedRoute>
              <SkillTreePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dockerfile-linter"
          element={
            <ProtectedRoute>
              <DockerfileLinterPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/git-bisect-game"
          element={
            <ProtectedRoute>
              <GitBisectGamePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/collab/:sessionId"
          element={
            <ProtectedRoute>
              <CollabSessionPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/collab-notes"
          element={
            <ProtectedRoute>
              <CollabNotesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/collab-notes/:roomId"
          element={
            <ProtectedRoute>
              <CollabNotesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pr-diff-summarizer"
          element={
            <ProtectedRoute>
              <PrDiffSummarizerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/test-terminal"
          element={
            <div className="flex h-screen gap-8 bg-[#0a0a0a] p-10">
              <div className="flex h-[600px] flex-1 flex-col">
                <h2 className="mb-4 text-xl font-bold text-white">
                  Interactive Git Terminal
                </h2>

                <GitTerminal />
              </div>

              <div className="flex h-[600px] flex-1 flex-col">
                <h2 className="mb-4 text-xl font-bold text-white">
                  Interactive Terminal Replay
                </h2>

                <TerminalReplay
                  sessionName="Git Tutorial Replay"
                  sharePathname="/sandbox"
                  commands={[
                    {
                      command: "git init",
                      output:
                        "Initialized empty Git repository in /workspace/.git/",
                      typingDelayMs: 60,
                      executionDelayMs: 400,
                    },
                    {
                      command: "git add .",
                      output: "",
                      typingDelayMs: 50,
                      executionDelayMs: 300,
                    },
                    {
                      command: "git commit -m 'Initial commit'",
                      output:
                        "[main (root-commit) 1a2b3c4] Initial commit\n" +
                        " 3 files changed, 120 insertions(+)\n" +
                        " create mode 100644 index.js\n" +
                        " create mode 100644 package.json",
                      typingDelayMs: 60,
                      executionDelayMs: 800,
                    },
                    {
                      command: "npm run test",
                      output:
                        "Running tests...\n" +
                        "PASS  src/test/app.test.js\n" +
                        "Test Suites: 1 passed, 1 total\n" +
                        "Tests:       3 passed, 3 total\n" +
                        "Snapshots:   0 total\n" +
                        "Time:        1.2s",
                      typingDelayMs: 50,
                      executionDelayMs: 1200,
                    },
                    {
                      command: "git status",
                      output:
                        "On branch main\n" +
                        "nothing to commit, working tree clean",
                      typingDelayMs: 60,
                      executionDelayMs: 500,
                    },
                  ]}
                />
              </div>
            </div>
          }
        />

        <Route
          path="/templates"
          element={
            <ProtectedRoute>
              <TemplateMarketplacePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/webhooks"
          element={
            <ProtectedRoute>
              <WebhookSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/peer-review"
          element={
            <ProtectedRoute>
              <PeerReviewPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/moderation"
          element={
            <ProtectedRoute>
              <ModerationDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute>
              <AuditLogViewerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/backups"
          element={
            <ProtectedRoute>
              <BackupDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/celery"
          element={
            <ProtectedRoute>
              <CeleryDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/bundle-performance"
          element={
            <ProtectedRoute>
              <PerformanceDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/performance"
          element={
            <ProtectedRoute>
              <ApiPerformanceDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/vulnerabilities"
          element={
            <ProtectedRoute>
              <VulnerabilityDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/security"
          element={
            <ProtectedRoute>
              <SecurityDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/portfolio"
          element={
            <ProtectedRoute>
              <PortfolioPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/content-studio"
          element={
            <ProtectedRoute>
              <ContentStudioPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shop"
          element={
            <ProtectedRoute>
              <ShopPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/content-studio/quizzes/:lessonId"
          element={
            <ProtectedRoute>
              <QuizBuilderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/content-studio/tree"
          element={
            <ProtectedRoute>
              <ModuleTreePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfileSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/notifications"
          element={
            <ProtectedRoute>
              <NotificationPreferencesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/docs/api"
          element={
            <RouteSuspenseWrapper>
              <ApiDocsPage />
            </RouteSuspenseWrapper>
          }
        />
        <Route
          path="/docs/env-generator"
          element={
            <RouteSuspenseWrapper>
              <EnvConfigGeneratorPage />
            </RouteSuspenseWrapper>
          }
        />
        <Route
          path="/docs/websocket-simulator"
          element={
            <RouteSuspenseWrapper>
              <WebSocketSimulatorPage />
            </RouteSuspenseWrapper>
          }
        />
        <Route
          path="/notifications/digest"
          element={
            <ProtectedRoute>
              <DigestPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/billing"
          element={
            <ProtectedRoute>
              <BillingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/invoices"
          element={
            <ProtectedRoute>
              <InvoiceHistoryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/oauth-clients"
          element={
            <ProtectedRoute>
              <OAuthClientsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/usage-analytics"
          element={
            <ProtectedRoute>
              <UsageAnalyticsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/connected-apps"
          element={
            <ProtectedRoute>
              <ConnectedAppsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pricing"
          element={
            <RouteSuspenseWrapper>
              <PricingPage />
            </RouteSuspenseWrapper>
          }
        />

        <Route
          path="/u/:username"
          element={
            <RouteSuspenseWrapper>
              <UserProfilePage />
            </RouteSuspenseWrapper>
          }
        />
      </Route>
    </Routes>
  );
}
