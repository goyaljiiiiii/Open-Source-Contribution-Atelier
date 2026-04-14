import { SectionCard } from "../components/ui/SectionCard";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";

export function CommunityPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["communityStats"],
    queryFn: () => fetchApi("/progress/community-stats/"),
  });

  const displayStats = [
    { label: "Weekly active contributors", value: stats?.active_contributors || "..." },
    { label: "Merged learning PRs", value: stats?.merged_prs || "..." },
    { label: "Mentor response SLA", value: stats?.response_sla || "..." },
    { label: "Open help requests", value: stats?.open_requests || "..." },
  ];

  return (
    <div className="space-y-6">
      <SectionCard eyebrow="Community" title="Leaderboards and cohort stats">
        <p className="max-w-2xl text-sm leading-6 text-muted">
          Track participation, mentor responsiveness, and support load across the program without losing the premium control-room feel.
        </p>
      </SectionCard>
      
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {displayStats.map((item) => (
            <SectionCard key={item.label} title={item.value.toString()}>
              <p className="text-sm text-muted">{item.label}</p>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
