import { SectionCard } from "../components/ui/SectionCard";
import { challengeCards } from "../lib/data";


export function ChallengePage() {
  return (
    <div className="space-y-6">
      <SectionCard eyebrow="Challenges" title="Recommended contribution drills">
        <p className="max-w-2xl text-sm leading-6 text-muted">
          Practice branching, clean commits, pull request preparation, and review-response workflows.
          Recommendation logic can adapt to progress, badges, and recent learner friction points.
        </p>
      </SectionCard>
      <div className="grid gap-6 lg:grid-cols-2">
        {challengeCards.map((item) => (
          <SectionCard key={item.title} eyebrow={item.badge} title={item.title}>
            <p className="text-sm leading-6 text-muted">{item.summary}</p>
            <button className="mt-5 rounded-xl bg-surface-low px-4 py-2 text-sm font-semibold text-primary">
              Open challenge
            </button>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
