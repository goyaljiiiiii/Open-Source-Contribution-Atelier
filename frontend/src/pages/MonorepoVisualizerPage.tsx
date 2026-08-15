import React from "react";
import { MonorepoDependencyGraph } from "../components/monorepo/MonorepoDependencyGraph";

export function MonorepoVisualizerPage() {
  return (
    <div className="p-6">
      <MonorepoDependencyGraph />
    </div>
  );
}

export default MonorepoVisualizerPage;
