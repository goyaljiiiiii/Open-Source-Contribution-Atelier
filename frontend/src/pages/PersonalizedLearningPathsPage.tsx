import React, { useState } from "react";
import {
  useLearningPathList,
  useLearningPathDetail,
  useGenerateLearningPaths,
  useCompleteStep,
  useStartStep,
  useSkipStep,
  useArchivePath,
  usePathCompletionEstimate,
  LearningPath,
  LearningPathListItem,
  LearningPathStep,
} from "../hooks/useLearningPaths";
import { useAuth } from "../features/auth/AuthContext";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Clock,
  Zap,
  ChevronRight,
  Target,
  Trophy,
  AlertCircle,
  Play,
  SkipForward,
  Trash2,
  RefreshCw,
  BookOpen,
  PenTool,
  FileText,
  Award,
  Layers,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-200 text-green-900 border-green-500",
  intermediate: "bg-blue-200 text-blue-900 border-blue-500",
  advanced: "bg-red-200 text-red-900 border-red-500",
  mixed: "bg-purple-200 text-purple-900 border-purple-500",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-amber-200 text-amber-900",
  completed: "bg-green-200 text-green-900",
  archived: "bg-gray-200 text-gray-700",
  paused: "bg-orange-200 text-orange-900",
};

const STEP_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-200 text-gray-700 border-gray-400",
  in_progress: "bg-blue-200 text-blue-900 border-blue-500",
  completed: "bg-green-200 text-green-900 border-green-500",
  skipped: "bg-yellow-200 text-yellow-900 border-yellow-500",
};

const STEP_TYPE_ICONS: Record<string, React.ReactNode> = {
  lesson: <BookOpen className="w-4 h-4" />,
  exercise: <PenTool className="w-4 h-4" />,
  quiz: <FileText className="w-4 h-4" />,
  challenge: <Zap className="w-4 h-4" />,
  review: <RefreshCw className="w-4 h-4" />,
  milestone: <Trophy className="w-4 h-4" />,
};

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const PathCard: React.FC<{
  path: LearningPathListItem;
  onSelect: (id: number) => void;
}> = ({ path, onSelect }) => (
  <button
    onClick={() => onSelect(path.id)}
    className="flex flex-col justify-between p-6 bg-white border-4 border-black rounded-2xl shadow-card-sm hover:shadow-card hover:-translate-y-1 transition-all dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none text-left w-full"
  >
    <div>
      <div className="flex justify-between items-center mb-3">
        <span
          className={`font-black text-[10px] uppercase px-2 py-0.5 rounded-full border-2 border-black ${DIFFICULTY_COLORS[path.difficulty] ?? "bg-gray-200"}`}
        >
          {path.difficulty}
        </span>
        <span
          className={`font-black text-[10px] uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[path.status] ?? "bg-gray-200"}`}
        >
          {path.status}
        </span>
      </div>
      <h4 className="text-lg font-black mb-2 dark:text-[#f0ebe2]">
        {path.title}
      </h4>
      <p className="text-xs font-bold text-muted mb-4 dark:text-[#c4bbae] line-clamp-2">
        {path.description}
      </p>
    </div>

    <div className="space-y-3 pt-3 border-t-2 border-dashed border-black/10 dark:border-white/10">
      <div className="flex justify-between items-center text-[10px] font-black">
        <span>PROGRESS</span>
        <span>
          {path.completed_steps} / {path.total_steps} STEPS
        </span>
      </div>
      <div className="w-full h-3 bg-surface-low border-2 border-black rounded-full overflow-hidden dark:bg-[#151411] dark:border-[#2e2924]">
        <div
          className="h-full bg-green-500 border-r-2 border-black transition-all duration-500"
          style={{
            width: `${path.progress_pct}%`,
          }}
        />
      </div>
      <div className="flex justify-between items-center text-[10px] font-bold text-muted dark:text-[#c4bbae]">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> {formatMinutes(path.estimated_minutes)}
        </span>
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3" /> {path.xp_reward} XP
        </span>
        <span className="flex items-center gap-1">
          <Target className="w-3 h-3" /> Priority: {path.priority_score}
        </span>
      </div>
      {path.next_step && (
        <div className="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-2 rounded border border-blue-200 dark:border-blue-800">
          ▶ Next: {path.next_step.title}
        </div>
      )}
    </div>
  </button>
);

const StepCard: React.FC<{
  step: LearningPathStep;
  isNext: boolean;
  onStart: (id: number) => void;
  onComplete: (id: number) => void;
  onSkip: (id: number) => void;
  isPending: boolean;
}> = ({ step, isNext, onStart, onComplete, onSkip, isPending }) => {
  const isNotStarted = step.status === "not_started";
  const isInProgress = step.status === "in_progress";
  const isCompleted = step.status === "completed";

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
        step.is_milestone
          ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600"
          : isCompleted
            ? "border-green-300 bg-green-50/50 dark:bg-green-900/10 dark:border-green-700"
            : isNext
              ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600 shadow-sm"
              : "border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-[#151411]"
      }`}
    >
      {/* Step number indicator */}
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-black text-sm shrink-0 ${
          isCompleted
            ? "bg-green-500 border-green-700 text-white"
            : isInProgress
              ? "bg-blue-500 border-blue-700 text-white animate-pulse"
              : step.is_milestone
                ? "bg-amber-400 border-amber-600 text-black"
                : "bg-white border-gray-300 text-gray-600 dark:bg-[#1f1c18] dark:border-gray-600 dark:text-gray-300"
        }`}
      >
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          step.step_number
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-muted dark:text-[#c4bbae]">
            {STEP_TYPE_ICONS[step.step_type] ?? (
              <Layers className="w-4 h-4" />
            )}
          </span>
          <span className="font-black text-xs uppercase tracking-widest text-muted dark:text-[#c4bbae]">
            {step.step_type}
          </span>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STEP_STATUS_COLORS[step.status] ?? ""}`}
          >
            {step.status.replace("_", " ")}
          </span>
          {step.is_milestone && (
            <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full border border-amber-500">
              🏆 MILESTONE
            </span>
          )}
        </div>
        <h5 className="font-black text-sm dark:text-[#f0ebe2] mb-1">
          {step.title}
        </h5>
        <p className="text-xs text-muted dark:text-[#c4bbae] mb-2">
          {step.description}
        </p>
        {step.reasoning && (
          <p className="text-[10px] italic text-muted/70 dark:text-[#c4bbae]/60 mb-2">
            💡 {step.reasoning}
          </p>
        )}
        <div className="flex items-center gap-3 text-[10px] font-bold text-muted dark:text-[#c4bbae]">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {formatMinutes(step.estimated_minutes)}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" /> {step.xp_reward} XP
          </span>
          {step.skill_tag && (
            <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
              {step.skill_tag.icon_emoji} {step.skill_tag.name}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 shrink-0">
        {isNotStarted && isNext && (
          <button
            onClick={() => onStart(step.id)}
            disabled={isPending}
            className="px-3 py-1.5 bg-blue-500 text-white text-[10px] font-black uppercase rounded-lg border-2 border-blue-700 hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3 inline mr-1" /> Start
          </button>
        )}
        {(isNotStarted || isInProgress) && (
          <>
            <button
              onClick={() => onComplete(step.id)}
              disabled={isPending}
              className="px-3 py-1.5 bg-green-500 text-white text-[10px] font-black uppercase rounded-lg border-2 border-green-700 hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-3 h-3 inline mr-1" /> Done
            </button>
            {!step.is_milestone && (
              <button
                onClick={() => onSkip(step.id)}
                disabled={isPending}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-[10px] font-black uppercase rounded-lg border-2 border-gray-400 hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                <SkipForward className="w-3 h-3 inline mr-1" /> Skip
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const CompletionEstimateCard: React.FC<{
  estimate: {
    active_path_count: number;
    total_remaining_steps: number;
    daily_step_velocity: number;
    estimated_completion_days: number;
    estimated_date: string | null;
  };
}> = ({ estimate }) => (
  <div className="rounded-[2rem] border-4 border-black bg-[#d4f5d4] p-6 sm:p-8 shadow-card dark:bg-[#1a2e1a] dark:border-[#2e2924] dark:shadow-none">
    <div className="flex items-center gap-3 mb-4">
      <span className="text-3xl">🎯</span>
      <div>
        <h3 className="font-black text-xl uppercase tracking-tight">
          Completion Forecast
        </h3>
        <p className="text-xs text-muted dark:text-[#c4bbae] font-bold">
          Based on your learning velocity
        </p>
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="bg-white/80 dark:bg-[#151411] border-2 border-black dark:border-[#2e2924] rounded-xl p-4 text-center">
        <p className="text-3xl font-black text-green-700 dark:text-green-400">
          {estimate.active_path_count}
        </p>
        <p className="text-[10px] font-black uppercase mt-1">Active Paths</p>
      </div>
      <div className="bg-white/80 dark:bg-[#151411] border-2 border-black dark:border-[#2e2924] rounded-xl p-4 text-center">
        <p className="text-3xl font-black text-blue-700 dark:text-blue-400">
          {estimate.total_remaining_steps}
        </p>
        <p className="text-[10px] font-black uppercase mt-1">Steps Left</p>
      </div>
      <div className="bg-white/80 dark:bg-[#151411] border-2 border-black dark:border-[#2e2924] rounded-xl p-4 text-center">
        <p className="text-3xl font-black text-purple-700 dark:text-purple-400">
          {estimate.daily_step_velocity.toFixed(1)}
        </p>
        <p className="text-[10px] font-black uppercase mt-1">Steps/Day</p>
      </div>
      <div className="bg-white/80 dark:bg-[#151411] border-2 border-black dark:border-[#2e2924] rounded-xl p-4 text-center">
        <p className="text-3xl font-black text-amber-700 dark:text-amber-400">
          {estimate.estimated_completion_days}
        </p>
        <p className="text-[10px] font-black uppercase mt-1">Days Left</p>
      </div>
    </div>
    {estimate.estimated_date && (
      <p className="text-xs font-bold text-center mt-4 text-green-800 dark:text-green-300">
        🎉 Estimated completion: {estimate.estimated_date}
      </p>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export const PersonalizedLearningPathsPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedPathId, setSelectedPathId] = useState<number | null>(null);

  // Queries
  const { data: pathList, isLoading: listLoading } = useLearningPathList();
  const { data: selectedPath, isLoading: detailLoading } =
    useLearningPathDetail(selectedPathId);
  const { data: estimate } = usePathCompletionEstimate();

  // Mutations
  const generateMutation = useGenerateLearningPaths();
  const completeStepMutation = useCompleteStep();
  const startStepMutation = useStartStep();
  const skipStepMutation = useSkipStep();
  const archiveMutation = useArchivePath();

  const isPending =
    completeStepMutation.isPending ||
    startStepMutation.isPending ||
    skipStepMutation.isPending;

  const handleCompleteStep = (stepId: number) => {
    completeStepMutation.mutate({ stepId });
  };

  const handleStartStep = (stepId: number) => {
    startStepMutation.mutate({ stepId });
  };

  const handleSkipStep = (stepId: number) => {
    skipStepMutation.mutate({ stepId });
  };

  const handleArchive = () => {
    if (selectedPathId !== null) {
      archiveMutation.mutate(
        { pathId: selectedPathId },
        { onSuccess: () => setSelectedPathId(null) },
      );
    }
  };

  const handleGenerate = () => {
    generateMutation.mutate({ force: false });
  };

  // Find the next unstarted step in the selected path
  const nextStepId = selectedPath?.steps.find(
    (s) => s.status === "not_started",
  )?.id;

  // ----- DETAIL VIEW -----
  if (selectedPathId !== null) {
    if (detailLoading) {
      return (
        <div className="pt-24 max-w-4xl mx-auto px-4 flex justify-center items-center h-screen">
          <div className="font-black text-2xl animate-pulse text-primary">
            Loading path details... 🗺️
          </div>
        </div>
      );
    }

    if (!selectedPath) {
      return (
        <div className="pt-24 max-w-4xl mx-auto px-4">
          <div className="p-8 text-center bg-red-100 rounded-2xl border-4 border-black font-bold text-red-800">
            Path not found.
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-12 space-y-8">
        {/* Back + Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedPathId(null)}
            className="p-2 border-2 border-black rounded-full hover:bg-gray-100 dark:border-[#2e2924] dark:hover:bg-[#1f1c18] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-black">{selectedPath.title}</h1>
            <p className="text-sm font-bold text-muted dark:text-[#c4bbae]">
              {selectedPath.description}
            </p>
          </div>
          <span
            className={`font-black text-xs uppercase px-3 py-1 rounded-full border-2 border-black ${STATUS_COLORS[selectedPath.status] ?? "bg-gray-200"}`}
          >
            {selectedPath.status}
          </span>
        </div>

        {/* Progress bar + stats */}
        <div className="rounded-[2rem] border-4 border-black bg-white p-6 sm:p-8 shadow-card dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
          <div className="flex justify-between items-center text-xs font-black mb-2">
            <span>PATH COMPLETION</span>
            <span>
              {selectedPath.completed_steps} / {selectedPath.total_steps} STEPS
              — {selectedPath.progress_pct}%
            </span>
          </div>
          <div className="w-full h-6 bg-gray-100 dark:bg-[#151411] border-2 border-black dark:border-[#2e2924] rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-green-500 border-r-2 border-black transition-all duration-500 rounded-full"
              style={{ width: `${selectedPath.progress_pct}%` }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-gray-50 dark:bg-[#151411] border-2 border-black dark:border-[#2e2924] rounded-xl">
              <p className="text-xl font-black">
                {formatMinutes(selectedPath.estimated_minutes)}
              </p>
              <p className="text-[10px] font-bold uppercase text-muted dark:text-[#c4bbae]">
                Est. Time
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-[#151411] border-2 border-black dark:border-[#2e2924] rounded-xl">
              <p className="text-xl font-black text-amber-600">
                {selectedPath.xp_reward}
              </p>
              <p className="text-[10px] font-bold uppercase text-muted dark:text-[#c4bbae]">
                XP Earned
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-[#151411] border-2 border-black dark:border-[#2e2924] rounded-xl">
              <p className="text-xl font-black text-blue-600">
                {selectedPath.priority_score}
              </p>
              <p className="text-[10px] font-bold uppercase text-muted dark:text-[#c4bbae]">
                Priority
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-[#151411] border-2 border-black dark:border-[#2e2924] rounded-xl">
              <p className="text-xl font-black">
                <span
                  className={`text-xs uppercase px-2 py-0.5 rounded-full border-2 border-black ${DIFFICULTY_COLORS[selectedPath.difficulty] ?? ""}`}
                >
                  {selectedPath.difficulty}
                </span>
              </p>
              <p className="text-[10px] font-bold uppercase text-muted dark:text-[#c4bbae]">
                Difficulty
              </p>
            </div>
          </div>
        </div>

        {/* Target skills */}
        {selectedPath.target_skills.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black uppercase text-muted dark:text-[#c4bbae]">
              Target Skills:
            </span>
            {selectedPath.target_skills.map((skill) => (
              <span
                key={skill.id}
                className="text-xs font-bold bg-white dark:bg-[#1f1c18] border-2 border-black dark:border-[#2e2924] rounded-full px-3 py-1"
              >
                {skill.icon_emoji} {skill.name}
              </span>
            ))}
          </div>
        )}

        {/* Steps */}
        <div className="space-y-3">
          <h3 className="text-xl font-black">
            📋 Steps ({selectedPath.steps.length})
          </h3>
          {selectedPath.steps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              isNext={step.id === nextStepId}
              onStart={handleStartStep}
              onComplete={handleCompleteStep}
              onSkip={handleSkipStep}
              isPending={isPending}
            />
          ))}
        </div>

        {/* Archive button */}
        <div className="pt-4">
          <button
            onClick={handleArchive}
            disabled={archiveMutation.isPending}
            className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-black uppercase rounded-lg border-2 border-red-300 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3 inline mr-1" /> Archive Path
          </button>
        </div>
      </div>
    );
  }

  // ----- LIST VIEW -----
  if (listLoading) {
    return (
      <div className="pt-24 max-w-7xl mx-auto px-4 flex justify-center items-center h-screen">
        <div className="font-black text-2xl animate-pulse text-primary">
          Loading your learning paths... 🗺️
        </div>
      </div>
    );
  }

  const paths = pathList ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 pt-24 pb-12 space-y-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard"
          className="p-2 border-2 border-black rounded-full hover:bg-gray-100 dark:border-[#2e2924] dark:hover:bg-[#1f1c18] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-black">Personalised Learning Paths</h1>
      </div>

      {/* Banner */}
      <section className="rounded-[2rem] border-4 border-black bg-[#c3c0ff] p-8 sm:p-10 shadow-card relative overflow-hidden dark:border-[#2e2924]">
        <div className="relative z-10 max-w-3xl">
          <span className="font-black text-xs bg-white text-black px-3 py-1 rounded-full border-2 border-black inline-block shadow-card-sm mb-4 dark:bg-[#151411] dark:text-[#f0ebe2] dark:border-[#2e2924]">
            AI-POWERED RECOMMENDATIONS ✨
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-black drop-shadow-[2px_2px_0_#fff] mb-4 dark:text-[#f0ebe2] dark:drop-shadow-none">
            Adaptive Paths Built for You
          </h2>
          <p className="text-base font-bold text-black bg-white/95 p-4 rounded-lg border-4 border-black shadow-card-sm leading-relaxed dark:bg-[#151411] dark:border-[#2e2924] dark:text-[#f0ebe2]">
            Our recommendation engine analyses your skill levels, learning
            velocity, active goals, and activity patterns to generate
            personalised learning paths. Each path contains ordered steps
            tailored to close skill gaps and keep you moving forward.
          </p>
        </div>
        <div className="absolute -right-6 -bottom-6 text-[10rem] opacity-20 rotate-12 pointer-events-none">
          🧭
        </div>
      </section>

      {/* Generate + Estimate */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-black text-white dark:bg-white dark:text-black font-black uppercase text-sm rounded-xl border-2 border-black shadow-card-sm hover:-translate-y-0.5 transition-all disabled:opacity-50"
        >
          {generateMutation.isPending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {generateMutation.isPending
            ? "Generating..."
            : "Generate New Paths"}
        </button>

        {generateMutation.data && (
          <div className="text-xs font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-lg border border-green-300 dark:border-green-700">
            ✅ Generated {generateMutation.data.generated} new paths
          </div>
        )}
      </div>

      {/* Completion forecast */}
      {estimate && <CompletionEstimateCard estimate={estimate} />}

      {/* Path Cards Grid */}
      <section className="space-y-6">
        <h3 className="text-2xl font-black flex items-center gap-2">
          <span>🗺️</span> Your Learning Paths ({paths.length})
        </h3>

        {paths.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#1f1c18] border-4 border-black dark:border-[#2e2924] rounded-2xl">
            <p className="text-xl font-black text-muted dark:text-[#c4bbae] mb-4">
              No learning paths yet
            </p>
            <p className="text-sm font-bold text-muted/70 dark:text-[#c4bbae]/70 mb-6">
              Click "Generate New Paths" to get personalised recommendations.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((p) => (
              <PathCard
                key={p.id}
                path={p}
                onSelect={setSelectedPathId}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PersonalizedLearningPathsPage;
