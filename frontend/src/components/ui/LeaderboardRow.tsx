import React from "react";
import { Link } from "react-router-dom";

export interface LeaderboardItem {
  rank: number;
  username: string;
  avatar_url: string;
  html_url?: string;
  xp: number;
}

interface LeaderboardRowProps {
  item: LeaderboardItem;
  isCurrentUser?: boolean;
}

export function LeaderboardRow({ item, isCurrentUser }: LeaderboardRowProps) {
  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return "text-[#FFD700] bg-[#FFD700]/10 border-[#FFD700]/30 shadow-[#FFD700]/20";
      case 2:
        return "text-[#E3E4E5] bg-[#E3E4E5]/10 border-[#E3E4E5]/30 shadow-[#E3E4E5]/20";
      case 3:
        return "text-[#CD7F32] bg-[#CD7F32]/10 border-[#CD7F32]/30 shadow-[#CD7F32]/20";
      default:
        return "text-muted bg-surface-low border-transparent shadow-none dark:text-slate-300";
    }
  };

  return (
    <div
      role="row"
      aria-live="polite"
      className={`flex items-center justify-between p-4 rounded-2xl border border-black/10 dark:border-white/10 transition-colors ${
        isCurrentUser
          ? "bg-indigo-50 dark:bg-indigo-500/10"
          : "hover:bg-black/5 dark:hover:bg-white/5"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 flex items-center justify-center rounded-xl font-black text-sm border ${getRankBadge(item.rank)}`}
        >
          #{item.rank}
        </div>
        <Link to={`/u/${item.username}`} className="flex items-center gap-3">
          <img
            src={item.avatar_url}
            alt={item.username}
            className="w-10 h-10 rounded-xl border border-black/10 dark:border-white/10 object-cover"
          />
          <div>
            <p className="font-black text-sm text-text dark:text-white flex items-center gap-1.5">
              {item.username}
              {isCurrentUser && (
                <span className="text-[9px] bg-indigo-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                  You
                </span>
              )}
            </p>
          </div>
        </Link>
      </div>
      <div className="font-black text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20">
        {item.xp.toLocaleString()} XP
      </div>
    </div>
  );
}

export default LeaderboardRow;
