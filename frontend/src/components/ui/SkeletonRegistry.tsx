import React, { Suspense } from "react";
import { useLocation } from "react-router-dom";
import { useSlowConnection } from "../../hooks/useSlowConnection";
import { ListPageSkeleton } from "./skeletons/ListPageSkeleton";
import { DetailPageSkeleton } from "./skeletons/DetailPageSkeleton";
import { TableSkeleton } from "./skeletons/TableSkeleton";
import { DashboardSkeleton } from "./skeletons/DashboardSkeleton";
import { SandboxSkeleton } from "./skeletons/SandboxSkeleton";
import SkeletonLesson from "./skeletons/SkeletonLesson";

// Define our skeleton registry patterns
const skeletonMap = [
  { pattern: /^\/dashboard$/, component: DashboardSkeleton },
  { pattern: /^\/leaderboard$/, component: TableSkeleton },
  { pattern: /^\/analytics$/, component: DashboardSkeleton },
  { pattern: /^\/lessons\/[^/]+$/, component: DetailPageSkeleton },
  { pattern: /^\/modules\/[^/]+$/, component: DetailPageSkeleton },
  { pattern: /^\/sandbox/, component: SandboxSkeleton },
  { pattern: /^\/admin/, component: DashboardSkeleton },
  // Generic lists
  { pattern: /^\/portfolio/, component: ListPageSkeleton },
  { pattern: /^\/market/, component: ListPageSkeleton },
];

function getSkeletonForRoute(path: string): React.ComponentType {
  const match = skeletonMap.find((item) => item.pattern.test(path));
  return match ? match.component : SkeletonLesson;
}

export function RouteSuspenseWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const showSkeleton = useSlowConnection(100);
  const location = useLocation();
  const SkeletonComponent = getSkeletonForRoute(location.pathname);

  // Fallback wrapper needs to maintain the min-h-screen for some pages if they expect it,
  // but SkeletonComponent should inherently be structurally identical to the actual page.
  return (
    <Suspense fallback={showSkeleton ? <SkeletonComponent /> : null}>
      {children}
    </Suspense>
  );
}
