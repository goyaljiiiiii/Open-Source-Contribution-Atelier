import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchApi } from "../../lib/api";
import { Check } from "lucide-react";
import toast from "react-hot-toast";

interface Notification {
  id: number;
  notif_type: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface DigestResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Notification[];
  unread_count: number;
}

export default function DigestPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [count, setCount] = useState(0);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(async (url: string, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const data = (await fetchApi(url)) as DigestResponse;
      setNotifications((current) =>
        append ? [...current, ...(data.results ?? [])] : (data.results ?? []),
      );
      setCount(data.unread_count ?? data.count ?? 0);
      setNextPage(data.next ?? null);
    } catch {
      toast.error("Failed to load digest");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPage("/notifications/digest/", false);
  }, [loadPage]);

  const grouped = useMemo(() => {
    return notifications.reduce<Record<string, Notification[]>>((groups, notif) => {
      (groups[notif.notif_type] ??= []).push(notif);
      return groups;
    }, {});
  }, [notifications]);

  const markAllRead = () => {
    fetchApi("/notifications/digest/read/", { method: "POST" })
      .then(() => {
        toast.success("All notifications marked as read");
        setNotifications([]);
        setCount(0);
        setNextPage(null);
      })
      .catch(() => {
        toast.error("Failed to mark notifications as read");
      });
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-24 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase text-black dark:text-white">
            Notification Digest
          </h1>
          <p className="text-gray-500 dark:text-[#c4bbae]">
            You have {count} unread notifications.
          </p>
        </div>
        {count > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 font-bold"
          >
            <Check size={18} />
            Mark all read
          </button>
        )}
      </div>

      {count === 0 ? (
        <div className="p-8 text-center border-4 border-black dark:border-[#2e2924] rounded-2xl bg-white dark:bg-[#151411]">
          <p className="text-gray-500 dark:text-[#c4bbae]">
            You&apos;re all caught up!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, notifs]) => (
            <div
              key={type}
              className="border-4 border-black dark:border-[#2e2924] rounded-2xl bg-white dark:bg-[#151411] overflow-hidden"
            >
              <div className="p-4 border-b-4 border-black dark:border-[#2e2924] bg-surface-low dark:bg-[#1f1c18]">
                <h2 className="text-xl font-bold uppercase">{type}</h2>
              </div>
              <div className="divide-y-2 divide-black dark:divide-[#2e2924]">
                {notifs.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-[#1f1c18] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-black dark:text-white">{notif.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-[#c4bbae] mt-1">{notif.message}</p>
                      </div>
                      <time className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(notif.created_at).toLocaleDateString()}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {nextPage && (
            <button
              onClick={() => void loadPage(nextPage, true)}
              disabled={loadingMore}
              className="w-full py-3 rounded-xl border-2 border-black bg-white dark:bg-[#1f1c18] font-bold text-sm text-black dark:text-white shadow-card-sm hover:-translate-y-0.5 hover:shadow-card active:translate-y-0 transition-all uppercase disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
