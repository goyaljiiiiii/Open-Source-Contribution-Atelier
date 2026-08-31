import React, { useState } from 'react';
import DockerfileLinterSection from '../components/docker/DockerfileLinter';

export function DockerfileLinterPage() {
  const [dockerfileContent, setDockerfileContent] = useState('FROM ubuntu:latest\nRUN apt-get update && apt-get install -y git\nCMD ["echo", "Hello Workspace"]');
  
  // Mock results mirroring back unified server-side AST output arrays
  const [lintResults] = useState([
    { severity: 'Error' as const, line: 1, message: 'Specify a strict semantic tag version instead of relying on "latest".', rule: 'dl-base-tag-latest' },
    { severity: 'Warning' as const, line: 2, message: 'Clean apt-get caches using "rm -rf /var/lib/apt/lists/*" on the same layer to eliminate bloat.', rule: 'dl-run-clean-cache' },
    { severity: 'Warning' as const, line: 2, message: 'Avoid pinless application downloads. Append package version descriptors.', rule: 'dl-run-version-pin' },
    { severity: 'Convention' as const, line: 3, message: 'Use JSON array configurations instead of bare executable strings for CMD.', rule: 'dl-cmd-json' }
  ]);

  // Segment flat arrays by matching enum keys
  const errors = lintResults.filter(r => r.severity === 'Error');
  const warnings = lintResults.filter(r => r.severity === 'Warning');
  const conventions = lintResults.filter(r => r.severity === 'Convention');

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Dockerfile Optimization Engine</h1>
        <p className="text-xs text-slate-400 mt-1">Submit your build layers to scrub context sizes and isolate credential leaks.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Workspace Code Input Area */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <textarea
            value={dockerfileContent}
            onChange={(e) => setDockerfileContent(e.target.value)}
            className="w-full h-80 bg-slate-950 font-mono text-xs text-slate-200 p-3 border border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </section>

        {/* Collapsible Accordion Severity Output List Container */}
        <section className="space-y-2">
          <DockerfileLinterSection title="Critical Security & Build Errors" severity="Error" issues={errors} />
          <DockerfileLinterSection title="Optimization Warnings" severity="Warning" issues={warnings} />
          <DockerfileLinterSection title="Style & Convention Violations" severity="Convention" issues={conventions} />
        </section>
      </div>
    </div>
  );
}

export default DockerfileLinterPage;
