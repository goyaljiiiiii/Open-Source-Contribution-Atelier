import { useCallback, useEffect, useRef, useState } from "react";
import { GitWasmEngine, GitDagNode } from "../engine/gitWasmEngine";
import type { FileTreeNode } from "../engine/virtualFileSystem";

export interface TerminalLine {
  id: number;
  text: string;
  kind: "command" | "output" | "error";
}

export interface GitSandboxState {
  cwd: string;
  lines: TerminalLine[];
  graphNodes: GitDagNode[];
  fileTree: FileTreeNode | null;
  initialized: boolean;
  branch: string;
  execute: (command: string) => Promise<void>;
  reset: () => void;
}

let lineCounter = 0;

function nextLineId(): number {
  lineCounter += 1;
  return lineCounter;
}

export function useGitSandbox(): GitSandboxState {
  const engineRef = useRef<GitWasmEngine | null>(null);
  const [cwd, setCwd] = useState("/");
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [graphNodes, setGraphNodes] = useState<GitDagNode[]>([]);
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [branch, setBranch] = useState("main");

  const refresh = useCallback(async (engine: GitWasmEngine) => {
    setGraphNodes(engine.getDag());
    setInitialized(engine.isInitialized());
    setBranch(engine.getCurrentBranch());
    const tree = await engine.getVfs().getTree();
    setFileTree(tree);
  }, []);

  useEffect(() => {
    const engine = new GitWasmEngine();
    engineRef.current = engine;
    engine
      .getVfs()
      .init()
      .then(() => refresh(engine))
      .catch(() => undefined);
  }, [refresh]);

  const execute = useCallback(
    async (command: string) => {
      const engine = engineRef.current;
      if (!engine) return;

      const trimmed = command.trim();
      if (!trimmed) return;

      setLines((prev) => [
        ...prev,
        { id: nextLineId(), text: trimmed, kind: "command" },
      ]);

      const vfs = engine.getVfs();
      const tokens = trimmed.split(/\s+/);
      const [bin] = tokens;

      try {
        if (bin === "cd") {
          const target = tokens[1] ?? "/";
          const newCwd =
            target === "/"
              ? "/"
              : target.startsWith("/")
                ? target
                : `${cwd.replace(/\/$/, "")}/${target}`;
          const exists = await vfs.exists(newCwd);
          if (!exists) {
            setLines((prev) => [
              ...prev,
              {
                id: nextLineId(),
                text: `cd: ${target}: No such file or directory`,
                kind: "error",
              },
            ]);
          } else {
            setCwd(newCwd.replace(/\/+/g, "/"));
          }
        } else if (bin === "pwd") {
          setLines((prev) => [
            ...prev,
            { id: nextLineId(), text: cwd, kind: "output" },
          ]);
        } else if (bin === "echo") {
          setLines((prev) => [
            ...prev,
            {
              id: nextLineId(),
              text: tokens.slice(1).join(" "),
              kind: "output",
            },
          ]);
        } else if (bin === "touch") {
          const path = tokens[1];
          if (path) {
            const full = path.startsWith("/") ? path : `${cwd}/${path}`;
            await vfs.writeFile(full.replace(/\/+/g, "/"), "");
          }
        } else if (bin === "mkdir") {
          const path = tokens[1];
          if (path) {
            const full = path.startsWith("/") ? path : `${cwd}/${path}`;
            await vfs.mkdir(full.replace(/\/+/g, "/"));
          }
        } else if (bin === "cat") {
          const path = tokens[1];
          if (path) {
            const full = path.startsWith("/") ? path : `${cwd}/${path}`;
            const content = (await vfs.readFile(full, {
              encoding: "utf8",
            })) as string;
            setLines((prev) => [
              ...prev,
              { id: nextLineId(), text: content, kind: "output" },
            ]);
          }
        } else if (bin === "git") {
          const output = await engine.execute(trimmed);
          setLines((prev) => [
            ...prev,
            ...output.map((text) => ({
              id: nextLineId(),
              text,
              kind: (text.startsWith("error:") || text.startsWith("fatal:")
                ? "error"
                : "output") as TerminalLine["kind"],
            })),
          ]);
        } else {
          setLines((prev) => [
            ...prev,
            {
              id: nextLineId(),
              text: `${bin}: command not found`,
              kind: "error",
            },
          ]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLines((prev) => [
          ...prev,
          { id: nextLineId(), text: msg, kind: "error" },
        ]);
      }

      await refresh(engine);
    },
    [cwd, refresh],
  );

  const reset = useCallback(() => {
    lineCounter = 0;
    const engine = new GitWasmEngine();
    engineRef.current = engine;
    setCwd("/");
    setLines([]);
    engine
      .getVfs()
      .init()
      .then(() => refresh(engine))
      .catch(() => undefined);
  }, [refresh]);

  return {
    cwd,
    lines,
    graphNodes,
    fileTree,
    initialized,
    branch,
    execute,
    reset,
  };
}
