import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchBounties, claimBounty, submitBounty, Bounty } from "../lib/api";
import { useAuth } from "../features/auth/AuthContext";
import { SectionCard } from "../components/ui/SectionCard";
import { CheckCircle, Target, Loader2 } from "lucide-react";
import { DataStateWrapper } from "../components/ui/DataStateWrapper";

export function BountiesPage() {
  const { user } = useAuth();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const loadBounties = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBounties();
      setBounties(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load open-source bounties. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBounties();
  }, []);

  const handleClaim = async (id: number) => {
    setClaimingId(id);
    try {
      await claimBounty(id);
      toast.success("Bounty claimed successfully!");
      loadBounties();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to claim bounty");
    } finally {
      setClaimingId(null);
    }
  };

  const handleSubmit = async (id: number) => {
    setSubmittingId(id);
    try {
      const res = await submitBounty(id, "fixed bug in main.js");
      toast.success(`Bounty completed! +${res.xp_earned} XP`);
      loadBounties();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to submit code");
    } finally {
      setSubmittingId(null);
    }
  };

  const skeletonNode = (
    <div className="grid gap-6 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="p-6 bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl animate-pulse flex flex-col gap-4"
        >
          <div className="flex justify-between items-center">
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-800 rounded"></div>
            <div className="h-5 w-14 bg-gray-200 dark:bg-gray-800 rounded"></div>
          </div>
          <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-800 rounded"></div>
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded"></div>
          <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-800 rounded"></div>
          <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded mt-4"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text dark:text-[#fff8ef]">
            Help Wanted Bounties
          </h1>
          <p className="mt-2 text-muted dark:text-[#d7cec0]">
            Claim open-source issues, fix them in the sandbox, and earn XP and badges!
          </p>
        </div>
      </div>

      <DataStateWrapper
        loading={loading}
        error={error}
        empty={bounties.length === 0}
        onRetry={loadBounties}
        skeleton={skeletonNode}
        emptyTitle="No Bounties Available"
        emptyDescription="There are currently no active help wanted bounties. Check back soon for new opportunities!"
        emptyIcon={Target}
      >
        <div className="grid gap-6 md:grid-cols-2">
          {bounties.map((bounty) => (
            <SectionCard key={bounty.id} className="flex flex-col h-full">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`px-2 py-1 text-xs font-bold uppercase rounded-md ${
                      bounty.status === "Open"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : bounty.status === "Claimed"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    {bounty.status}
                  </span>
                  <div className="flex items-center gap-1 font-bold text-amber-500">
                    <Target size={16} />
                    {bounty.xp_reward} XP
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2 dark:text-white">
                  {bounty.title}
                </h3>
                <p className="text-sm text-muted dark:text-gray-400 line-clamp-3">
                  {bounty.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                {bounty.status === "Open" ? (
                  <button
                    onClick={() => handleClaim(bounty.id)}
                    disabled={claimingId === bounty.id}
                    className="w-full px-4 py-2 bg-primary text-black font-bold rounded-lg border-4 border-black shadow-card hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-card-sm transition-all disabled:opacity-60"
                  >
                    {claimingId === bounty.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                    ) : null}
                    Claim Bounty
                  </button>
                ) : bounty.status === "Claimed" &&
                  bounty.claimed_by === user?.id ? (
                  <div className="flex w-full gap-2">
                    <Link
                      to="/sandbox"
                      className="flex-1 px-4 py-2 text-center bg-white text-black font-bold rounded-lg border-4 border-black shadow-card hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-card-sm transition-all"
                    >
                      Sandbox
                    </Link>
                    <button
                      className="flex-1 px-4 py-2 bg-primary text-black font-bold rounded-lg border-4 border-black shadow-card hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-card-sm transition-all disabled:opacity-60"
                      onClick={() => handleSubmit(bounty.id)}
                      disabled={submittingId === bounty.id}
                    >
                      {submittingId === bounty.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                      ) : null}
                      Submit Code
                    </button>
                  </div>
                ) : bounty.status === "Claimed" ? (
                  <p className="text-sm text-muted w-full text-center">
                    Claimed by {bounty.claimed_by_username}
                  </p>
                ) : (
                  <div className="flex items-center justify-center w-full gap-2 text-green-500 font-bold">
                    <CheckCircle size={18} />
                    Completed by {bounty.claimed_by_username}
                  </div>
                )}
              </div>
            </SectionCard>
          ))}
        </div>
      </DataStateWrapper>
    </div>
  );
}
