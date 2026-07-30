import React from "react";
import { Skeleton } from "../Skeleton";

export function SandboxSkeleton() {
  return (
    <div className="flex h-screen w-full flex-col lg:flex-row bg-surface-low p-2 gap-2">
      {/* Sidebar */}
      <div className="w-full lg:w-64 h-full rounded-xl border-4 border-black bg-white flex flex-col p-4 gap-4">
        <Skeleton className="h-8 w-3/4 rounded" />
        <div className="space-y-2 mt-4 flex-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full rounded" />
          ))}
        </div>
      </div>
      
      {/* Main Panel */}
      <div className="flex-1 flex flex-col gap-2">
        {/* Editor */}
        <div className="flex-1 rounded-xl border-4 border-black bg-white p-4">
          <Skeleton className="h-6 w-48 rounded mb-4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
          </div>
        </div>
        
        {/* Terminal */}
        <div className="h-64 rounded-xl border-4 border-black bg-black p-4">
          <Skeleton className="h-6 w-32 rounded bg-surface-high mb-4" />
          <Skeleton className="h-4 w-full rounded bg-surface-highest/20 mb-2" />
          <Skeleton className="h-4 w-2/3 rounded bg-surface-highest/20" />
        </div>
      </div>
    </div>
  );
}
