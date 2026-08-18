import React from "react";
import { Skeleton } from "../Skeleton";

export function TableSkeleton() {
  return (
    <div className="w-full overflow-hidden rounded-[2rem] border-4 border-black bg-surface-low shadow-card">
      <div className="w-full overflow-x-auto p-6">
        {/* Header */}
        <div className="flex border-b-4 border-black pb-4 mb-4">
          <Skeleton className="h-6 w-1/4 rounded mr-4" />
          <Skeleton className="h-6 w-1/4 rounded mr-4" />
          <Skeleton className="h-6 w-1/4 rounded mr-4" />
          <Skeleton className="h-6 w-1/4 rounded" />
        </div>
        
        {/* 8 Body Rows */}
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex border-b-2 border-black/10 pb-4">
              <Skeleton className="h-5 w-1/4 rounded mr-4" />
              <Skeleton className="h-5 w-1/4 rounded mr-4" />
              <Skeleton className="h-5 w-1/4 rounded mr-4" />
              <Skeleton className="h-5 w-1/4 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
