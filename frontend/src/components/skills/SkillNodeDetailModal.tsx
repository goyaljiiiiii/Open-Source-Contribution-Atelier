import React from "react";
import {
  X,
  Award,
  BookOpen,
  CheckCircle2,
  Lock,
  Zap,
  ArrowRight,
  ShieldCheck,
  Code,
  GitBranch,
  Layers,
  Sparkles,
} from "lucide-react";

export interface SkillNode {
  id: string;
  title: string;
  domain: string;
  category: string;
  description: string;
  prerequisites: string[];
  status: "locked" | "unlocked" | "in_progress" | "completed";
  xp_reward: number;
  difficulty: string;
  position: { x: number; y: number };
  recommended_lessons: { id: string; title: string; duration: string }[];
  related_challenges: { id: string; title: string; xp: number }[];
  badge_reward?: { name: string; icon: string; color: string };
  progress_percent: number;
}

interface SkillNodeDetailModalProps {
  node: SkillNode | null;
  allNodes: SkillNode[];
  onClose: () => void;
  onCompleteNode: (nodeId: string) => void;
  isLoading?: boolean;
}

export const SkillNodeDetailModal: React.FC<SkillNodeDetailModalProps> = ({
  node,
  allNodes,
  onClose,
  onCompleteNode,
  isLoading = false,
}) => {
  if (!node) return null;

  // Check prerequisites status
  const prereqNodes = node.prerequisites.map((id) => {
    const found = allNodes.find((n) => n.id === id);
    return {
      id,
      title: found ? found.title : id,
      isCompleted: found?.status === "completed",
    };
  });

  const canMaster =
    node.status !== "completed" &&
    prereqNodes.every((p) => p.isCompleted);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-modal-title"
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="relative p-6 bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <span
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${
                node.status === "completed"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : node.status === "unlocked"
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {node.status}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {node.category} • {node.difficulty}
            </span>
          </div>

          <h2
            id="skill-modal-title"
            className="text-2xl font-black text-white tracking-tight"
          >
            {node.title}
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            {node.description}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Prerequisites Checklist */}
          {prereqNodes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Prerequisite Mastery Requirements
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {prereqNodes.map((prereq) => (
                  <div
                    key={prereq.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      prereq.isCompleted
                        ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-200"
                        : "bg-slate-800/40 border-slate-700 text-slate-400"
                    }`}
                  >
                    {prereq.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate">
                      {prereq.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Lessons */}
          {node.recommended_lessons.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                Recommended Interactive Lessons
              </h3>
              <div className="space-y-2">
                {node.recommended_lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Code className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-medium text-slate-200 group-hover:text-cyan-300">
                        {lesson.title}
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-700/80 rounded text-slate-400">
                      {lesson.duration}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Challenges */}
          {node.related_challenges.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Skill Mastery Challenges
              </h3>
              <div className="space-y-2">
                {node.related_challenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className="flex items-center justify-between p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl"
                  >
                    <span className="text-xs font-medium text-amber-200">
                      {challenge.title}
                    </span>
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> +{challenge.xp} XP
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rewards Section */}
          <div className="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600/30 rounded-xl text-indigo-400 border border-indigo-500/30">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">
                  Skill Mastery Reward
                </p>
                <p className="text-sm font-bold text-white">
                  +{node.xp_reward} Contributor XP
                </p>
              </div>
            </div>
            {node.badge_reward && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase">
                  Badge Unlocked
                </span>
                <p className="text-xs font-bold text-emerald-400">
                  🏅 {node.badge_reward.name}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            Close
          </button>

          {node.status === "completed" ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/40">
              <CheckCircle2 className="w-4 h-4" /> Skill Mastered
            </div>
          ) : (
            <button
              onClick={() => onCompleteNode(node.id)}
              disabled={!canMaster || isLoading}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg ${
                canMaster
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/25 active:scale-95"
                  : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                "Processing..."
              ) : canMaster ? (
                <>
                  Master Skill & Unlock Path <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Prerequisites Locked
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
