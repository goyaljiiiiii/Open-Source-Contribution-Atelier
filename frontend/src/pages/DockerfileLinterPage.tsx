import React from "react";
import { DockerfileLinter } from "../components/docker/DockerfileLinter";

export function DockerfileLinterPage() {
  return (
    <div className="p-6">
      <DockerfileLinter />
    </div>
  );
}

export default DockerfileLinterPage;
