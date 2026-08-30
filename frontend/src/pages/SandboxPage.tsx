import React, { useState } from "react";
import { ProjectWorkspace } from "../components/ui/ProjectWorkspace";
import { OnboardingTour } from "../components/ui/OnboardingTour";
import { TerminalReplay } from "../components/ui/TerminalReplay";
import { Map, Link2, AlertCircle, X, Volume2, VolumeX } from "lucide-react";
import { Step } from "react-joyride";
import { useTerminalReplayFromHash } from "../hooks/useTerminalReplayFromHash";
import {
  DEFAULT_SHARE_DEMO_COMMANDS,
  buildReplayShareUrl,
  encodeReplayHash,
} from "../lib/terminalReplayShare";
import {
  isSandboxSoundEnabled,
  setSandboxSoundEnabled,
} from "../hooks/useSandboxCore";

const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20];

export function SandboxPage() {
  const [runTour, setRunTour] = useState(false);
  const [demoCopied, setDemoCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(isSandboxSoundEnabled);

  const [soundEnabled, setSoundEnabled] = useState(isSandboxSoundEnabled);

  const [currentSize, setCurrentSize] = useState<number>(() => {
    const saved = localStorage.getItem("sandbox_editor_font_size");
    return saved ? parseInt(saved, 10) : 14;
  });

  const handleFontSizeChange = (size: number) => {
    setCurrentSize(size);
    localStorage.setItem("sandbox_editor_font_size", size.toString());
    window.dispatchEvent(new Event("sandbox_font_changed"));
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      setSandboxSoundEnabled(next);
      return next;
    });
  };
  const { commands, sessionName, hasReplayHash, error, reloadFromHash } =
    useTerminalReplayFromHash();

  const sandboxSteps: Step[] = [
    {
      target: "#tour-sandbox-explorer",
      title: "Project Explorer 📁",
      content:
        "Create, rename, and organize your files and folders here. Navigate through your project seamlessly.",
      placement: "right",
      skipBeacon: true,
    },
    {
      target: "#tour-sandbox-search",
      title: "Search Panel 🔍",
      content:
        "Quickly search for keywords and find exactly what you need across all your files.",
      placement: "right",
    },
    {
      target: "#tour-sandbox-editor",
      title: "Code Editor ✍️",
      content:
        "Write your code with full syntax highlighting, error checking, and auto-completion built right in.",
      placement: "left",
    },
    {
      target: "#tour-sandbox-tools",
      title: "Workspace Tools 🛠️",
      content:
        "Export your project, save snippets for later, or manage snapshots to revert changes easily.",
      placement: "bottom",
    },
    {
      target: "#tour-sandbox-terminal",
      title: "Interactive Terminal 💻",
      content:
        "Run bash commands, compile code, test applications, or interact with Git right from the browser.",
      placement: "top",
    },
  ];

  const loadDemoReplay = () => {
    const hash = encodeReplayHash(
      DEFAULT_SHARE_DEMO_COMMANDS,
      "Mentor demo replay",
    );
    if (hash) {
      window.location.hash = hash;
    }
  };

  const copyDemoLink = async () => {
    const url = buildReplayShareUrl({
      commands: DEFAULT_SHARE_DEMO_COMMANDS,
      sessionName: "Mentor demo replay",
      pathname: "/sandbox",
    });
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setDemoCopied(true);
      setTimeout(() => setDemoCopied(false), 2000);
    } catch {
      window.location.hash = url.slice(url.indexOf("#") + 1);
    }
  };

  const clearReplayHash = () => {
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", `${pathname}${search}`);
    reloadFromHash();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 flex flex-col h-[calc(100vh-64px)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-text dark:text-[#f0ebe2]">
            Interactive Workspace
          </h1>
          <p className="mt-2 text-muted dark:text-[#c4bbae]">
            Write and organize multi-file projects safely in the browser. Share
            terminal replays via URL hash for mentors and PR demos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 mr-2">
            <label htmlFor="font-size-select" className="text-sm font-bold text-muted dark:text-[#c4bbae] hidden sm:block">Font Size:</label>
            <select
              id="font-size-select"
              value={currentSize}
              onChange={(e) => handleFontSizeChange(parseInt(e.target.value, 10))}
              className="rounded-xl border-2 border-black dark:border-[#2e2924] px-2 py-1.5 text-sm font-bold bg-surface dark:bg-[#1a1a1a] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all outline-none cursor-pointer"
            >
              {FONT_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={!soundEnabled}
            aria-label={
              soundEnabled
                ? "Mute execution sound effects"
                : "Unmute execution sound effects"
            }
            title={
              soundEnabled
                ? "Mute execution sound effects"
                : "Unmute execution sound effects"
            }
            className="flex items-center gap-2 px-4 py-2 font-bold text-sm bg-surface dark:bg-[#1a1a1a] border-2 border-black dark:border-[#2e2924] rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void copyDemoLink()}
            className="flex items-center gap-2 px-4 py-2 font-bold text-sm bg-primary border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
          >
            <Link2 className="w-4 h-4" />
            {demoCopied ? "Link copied" : "Copy demo replay link"}
          </button>
          <button
            type="button"
            onClick={loadDemoReplay}
            className="flex items-center gap-2 px-4 py-2 font-bold text-sm bg-surface dark:bg-[#1a1a1a] border-2 border-black dark:border-[#2e2924] rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
          >
            Load demo replay
          </button>
          <button
            onClick={() => setRunTour(true)}
            className="flex items-center gap-2 px-4 py-2 font-bold text-sm bg-surface dark:bg-[#1a1a1a] border-2 border-black dark:border-[#2e2924] rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
          >
            <Map className="w-4 h-4 text-primary" />
            Take a Tour
          </button>
        </div>
      </div>

      {hasReplayHash && error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border-4 border-dashed border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/20"
        >
          <AlertCircle
            className="h-5 w-5 shrink-0 text-amber-700"
            aria-hidden
          />
          <div className="flex-1">
            <p className="font-black text-amber-900 dark:text-amber-200">
              Couldn’t load shared replay
            </p>
            <p className="text-sm font-bold text-amber-800/90 dark:text-amber-300">
              {error}
            </p>
          </div>
          <button
            type="button"
            onClick={clearReplayHash}
            className="rounded-lg border-2 border-black p-1"
            aria-label="Dismiss replay error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {hasReplayHash && !error && commands.length > 0 && (
        <section
          className="h-[320px] shrink-0"
          data-testid="sandbox-shared-replay"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide dark:text-[#f0ebe2]">
              Shared terminal replay
            </h2>
            <button
              type="button"
              onClick={clearReplayHash}
              className="text-xs font-bold underline underline-offset-2 text-muted"
            >
              Close replay
            </button>
          </div>
          <TerminalReplay
            key={sessionName + commands.map((c) => c.command).join("|")}
            sessionName={sessionName}
            commands={commands}
            sharePathname="/sandbox"
          />
        </section>
      )}

      <div className="flex-1 min-h-[500px]">
        <ProjectWorkspace />
      </div>

      <OnboardingTour
        run={runTour}
        onFinish={() => setRunTour(false)}
        steps={sandboxSteps}
      />
    </div>
  );
}

export default SandboxPage;
