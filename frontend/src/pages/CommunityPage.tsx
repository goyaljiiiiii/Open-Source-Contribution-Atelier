import { SectionCard } from "../components/ui/SectionCard";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchApi } from "../lib/api";
import SkeletonStatGrid from "../components/ui/skeletons/SkeletonStatGrid";

export function CommunityPage() {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["communityStats"],
    queryFn: () => fetchApi("/progress/community-stats/"),
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchApi("/progress/leaderboard/"),
  });

  const filteredLeaderboard = useMemo(() => {
    return [...leaderboard]
      .filter((user: any) =>
        user.name.toLowerCase().includes(search.toLowerCase())
      )
      .filter((user: any) =>
        typeFilter === "all"
          ? true
          : user.contribution_type === typeFilter
      )
      .sort((a: any, b: any) =>
        sortOrder === "desc"
          ? b.points - a.points
          : a.points - b.points
      );
  }, [leaderboard, search, sortOrder, typeFilter]);

  const displayStats = [
    {
      label: "Weekly active contributors",
      value: stats?.active_contributors || "...",
    },
    {
      label: "Merged learning PRs",
      value: stats?.merged_prs || "...",
    },
    {
      label: "Mentor response SLA",
      value: stats?.response_sla || "...",
    },
    {
      label: "Open help requests",
      value: stats?.open_requests || "...",
    },
  ];

  return (
    <div className="space-y-6">
      <SectionCard eyebrow="Community" title="Leaderboards and cohort stats">
        <p className="max-w-2xl text-sm leading-6 text-muted">
          Track participation, mentor responsiveness, and support load across
          the program without losing the premium control-room feel.
        </p>
      </SectionCard>

      {isLoading ? (
        <div aria-busy="true">
          <SkeletonStatGrid />
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

      <SectionCard title="Leaderboard">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search contributor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded border px-3 py-2"
            />

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded border px-3 py-2"
            >
              <option value="all">All</option>
              <option value="Learner">Learner</option>
              <option value="Mentor">Mentor</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="rounded border px-3 py-2"
            >
              <option value="desc">Highest Points</option>
              <option value="asc">Lowest Points</option>
            </select>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left">Rank</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Points</th>
              </tr>
            </thead>

            <tbody>
              {filteredLeaderboard.map((user: any, index: number) => (
                <tr key={`${user.name}-${index}`}>
                  <td className="p-2">{index + 1}</td>
                  <td className="p-2">{user.name}</td>
                  <td className="p-2">{user.contribution_type}</td>
                  <td className="p-2">{user.points}</td>
                </tr>
              ))}

              {filteredLeaderboard.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center">
                    No contributors found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}