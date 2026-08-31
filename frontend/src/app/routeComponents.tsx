import { lazy } from "react";

/*
 * Route components are loaded only when their route is visited.
 * Most pages in this project use named exports, so their imports
 * are mapped to the default export shape required by React.lazy().
 */

export const FullStackDocsPage = lazy(() =>
  import("../pages/docs/FullStackDocsPage").then((module) => ({
    default: module.FullStackDocsPage,
  })),
);

export const ChallengePage = lazy(() =>
  import("../pages/ChallengePage").then((module) => ({
    default: module.ChallengePage,
  })),
);

export const A11yLinterSandbox = lazy(() =>
  import("../components/ui/A11yLinterSandbox").then((module) => ({
    default: module.A11yLinterSandbox,
  })),
);

export const ChatPage = lazy(() =>
  import("../pages/ChatPage").then((module) => ({
    default: module.ChatPage,
  })),
);

export const CommunityPage = lazy(() =>
  import("../pages/CommunityPage").then((module) => ({
    default: module.CommunityPage,
  })),
);

export const DashboardPage = lazy(() =>
  import("../pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);

export const GitHubAuthCallbackPage = lazy(() =>
  import("../pages/GitHubAuthCallbackPage").then((module) => ({
    default: module.GitHubAuthCallbackPage,
  })),
);

export const LandingPage = lazy(() =>
  import("../pages/LandingPage").then((module) => ({
    default: module.LandingPage,
  })),
);

export const LoginPage = lazy(() =>
  import("../pages/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);

export const SignupPage = lazy(() =>
  import("../pages/SignupPage").then((module) => ({
    default: module.SignupPage,
  })),
);

export const LessonPage = lazy(() =>
  import("../pages/LessonPage").then((module) => ({
    default: module.LessonPage,
  })),
);

export const LessonCollaboratePage = lazy(() =>
  import("../pages/LessonCollaboratePage").then((module) => ({
    default: module.LessonCollaboratePage,
  })),
);

export const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage").then((module) => ({
    default: module.NotFoundPage,
  })),
);

export const ServerErrorPage = lazy(() =>
  import("../pages/ServerErrorPage").then((module) => ({
    default: module.ServerErrorPage,
  })),
);

export const ModerationDashboard = lazy(() =>
  import("../pages/ModerationDashboard").then((module) => ({
    default: module.ModerationDashboard,
  })),
);

export const BackupDashboardPage = lazy(() =>
  import("../pages/admin/BackupDashboardPage").then((module) => ({
    default: module.default,
  })),
);

export const AuditLogViewerPage = lazy(() =>
  import("../pages/admin/AuditLogViewerPage").then((module) => ({
    default: module.AuditLogViewerPage,
  })),
);

export const CeleryDashboardPage = lazy(() =>
  import("../pages/admin/CeleryDashboardPage").then((module) => ({
    default: module.default,
  })),
);

export const ApiPerformanceDashboardPage = lazy(() =>
  import("../pages/admin/ApiPerformanceDashboardPage").then((module) => ({
    default: module.default,
  })),
);

export const VulnerabilityDashboard = lazy(() =>
  import("../pages/admin/VulnerabilityDashboard").then((module) => ({
    default: module.VulnerabilityDashboard,
  })),
);

export const SecurityDashboardPage = lazy(() =>
  import("../pages/SecurityDashboardPage").then((module) => ({
    default: module.SecurityDashboardPage,
  })),
);

export const SandboxPage = lazy(() =>
  import("../pages/SandboxPage").then((module) => ({
    default: module.SandboxPage,
  })),
);

export const ContributorSandboxPage = lazy(() =>
  import("../pages/ContributorSandboxPage").then((module) => ({
    default: module.ContributorSandboxPage,
  })),
);

export const GitSubmoduleSimulatorPage = lazy(() =>
  import("../pages/GitSubmoduleSimulatorPage").then((module) => ({
    default: module.GitSubmoduleSimulatorPage,
  })),
);

export const GitStashManagerPage = lazy(() =>
  import("../pages/GitStashManagerPage").then((module) => ({
    default: module.GitStashManagerPage,
  })),
);

export const GitRebaseVisualizerPage = lazy(() =>
  import("../pages/GitRebaseVisualizerPage").then((module) => ({
    default: module.GitRebaseVisualizerPage,
  })),
);

export const MonorepoVisualizerPage = lazy(() =>
  import("../pages/MonorepoVisualizerPage").then((module) => ({
    default: module.MonorepoVisualizerPage,
  })),
);

export const DockerfileLinterPage = lazy(() =>
  import("../pages/DockerfileLinterPage").then((module) => ({
    default: module.DockerfileLinterPage,
  })),
);

export const GitBisectGamePage = lazy(() =>
  import("../pages/GitBisectGamePage").then((module) => ({
    default: module.GitBisectGamePage,
  })),
);

export const CollabSessionPage = lazy(() =>
  import("../pages/CollabSessionPage").then((module) => ({
    default: module.CollabSessionPage,
  })),
);

export const CollabNotesPage = lazy(() =>
  import("../pages/CollabNotesPage").then((module) => ({
    default: module.CollabNotesPage,
  })),
);

export const PrDiffSummarizerPage = lazy(() =>
  import("../pages/PrDiffSummarizerPage").then((module) => ({
    default: module.PrDiffSummarizerPage,
  })),
);

export const ProfileSettingsPage = lazy(() =>
  import("../pages/ProfileSettingsPage").then((module) => ({
    default: module.ProfileSettingsPage,
  })),
);

export const NotificationPreferencesPage = lazy(() =>
  import("../pages/settings/NotificationPreferencesPage").then((module) => ({
    default: module.NotificationPreferencesPage,
  })),
);

export const DigestPage = lazy(() =>
  import("../pages/notifications/DigestPage").then((module) => ({
    default: module.default,
  })),
);

export const PricingPage = lazy(() =>
  import("../pages/PricingPage").then((module) => ({
    default: module.PricingPage,
  })),
);

export const BillingPage = lazy(() =>
  import("../pages/settings/BillingPage").then((module) => ({
    default: module.BillingPage,
  })),
);

export const InvoiceHistoryPage = lazy(() =>
  import("../pages/settings/InvoiceHistoryPage").then((module) => ({
    default: module.InvoiceHistoryPage,
  })),
);

export const WebhookSettingsPage = lazy(() =>
  import("../pages/WebhookSettingsPage").then((module) => ({
    default: module.WebhookSettingsPage,
  })),
);

export const UserProfilePage = lazy(() =>
  import("../pages/UserProfilePage").then((module) => ({
    default: module.UserProfilePage,
  })),
);

export const LeaderboardPage = lazy(() =>
  import("../pages/LeaderboardPage").then((module) => ({
    default: module.LeaderboardPage,
  })),
);

export const ShopPage = lazy(() =>
  import("../pages/ShopPage").then((module) => ({
    default: module.ShopPage,
  })),
);

export const VerifyCertificatePage = lazy(() =>
  import("../pages/VerifyCertificatePage").then((module) => ({
    default: module.VerifyCertificatePage,
  })),
);

export const PeerReviewPage = lazy(() =>
  import("../pages/PeerReviewPage").then((module) => ({
    default: module.PeerReviewPage,
  })),
);

export const PathwayPage = lazy(() =>
  import("../pages/PathwayPage").then((module) => ({
    default: module.PathwayPage,
  })),
);

export const SkillTreePage = lazy(() =>
  import("../pages/SkillTreePage").then((module) => ({
    default: module.SkillTreePage,
  })),
);

export const LearningPathPage = lazy(() =>
  import("../pages/LearningPathPage").then((module) => ({
    default: module.LearningPathPage,
  })),
);

export const BountiesPage = lazy(() =>
  import("../pages/BountiesPage").then((module) => ({
    default: module.BountiesPage,
  })),
);

export const GoodFirstIssueFinderPage = lazy(() =>
  import("../pages/GoodFirstIssueFinderPage").then((module) => ({
    default: module.GoodFirstIssueFinderPage,
  })),
);

export const MaintainerReplyToneCoachPage = lazy(() =>
  import("../pages/MaintainerReplyToneCoachPage").then((module) => ({
    default: module.MaintainerReplyToneCoachPage,
  })),
);

export const MergeConflictScenarioBuilderPage = lazy(() =>
  import("../pages/MergeConflictScenarioBuilderPage").then((module) => ({
    default: module.MergeConflictScenarioBuilderPage,
  })),
);

export const PerformanceDashboardPage = lazy(() =>
  import("../pages/admin/PerformanceDashboardPage").then((module) => ({
    default: module.PerformanceDashboardPage,
  })),
);

export const ContentStudioPage = lazy(() =>
  import("../pages/admin/ContentStudioPage").then((module) => ({
    default: module.ContentStudioPage,
  })),
);

export const QuizBuilderPage = lazy(() =>
  import("../pages/admin/QuizBuilderPage").then((module) => ({
    default: module.QuizBuilderPage,
  })),
);

export const ModuleTreePage = lazy(() =>
  import("../pages/admin/ModuleTreePage").then((module) => ({
    default: module.ModuleTreePage,
  })),
);

/*
 * These pages use default exports, so they can be passed directly
 * to React.lazy().
 */
export const AnalyticsDashboardPage = lazy(
  () => import("../pages/AnalyticsDashboardPage"),
);

export const TemplateMarketplacePage = lazy(
  () => import("../pages/TemplateMarketplacePage"),
);

export const PortfolioPage = lazy(() => import("../pages/PortfolioPage"));

export const ApiDocsPage = lazy(() =>
  import("../pages/ApiDocsPage").then((module) => ({
    default: module.ApiDocsPage,
  })),
);

export const EnvConfigGeneratorPage = lazy(
  () => import("../pages/EnvConfigGeneratorPage"),
);

export const WebSocketSimulatorPage = lazy(
  () => import("../pages/docs/WebSocketSimulatorPage"),
);

export const OAuthClientsPage = lazy(() =>
  import("../pages/admin/OAuthClients").then((module) => ({
    default: module.OAuthClients,
  })),
);

export const UsageAnalyticsPage = lazy(
  () => import("../pages/admin/UsageAnalyticsPage"),
);

export const ConnectedAppsPage = lazy(() =>
  import("../pages/settings/ConnectedApps").then((module) => ({
    default: module.ConnectedApps,
  })),
);

export const GitBranchSimulatorPage = lazy(() =>
  import("../pages/GitBranchSimulatorPage").then((module) => ({
    default: module.GitBranchSimulatorPage,
  })),
);

export const ColorPaletteGeneratorPage = lazy(() =>
  import("../pages/ColorPaletteGeneratorPage").then((module) => ({
    default: module.ColorPaletteGeneratorPage,
  })),
);
