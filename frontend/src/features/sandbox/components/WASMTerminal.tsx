import { useCallback, useRef, useState } from "react";
import { useGitSandbox } from "../hooks/useGitSandbox";

export function WASMTerminal() {
  const { cwd, lines, branch, initialized, execute, reset } = useGitSandbox();
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const cmd = input.trim();
      if (!cmd) return;
      setHistory((h) => [...h, cmd]);
      setHistIdx(-1);
      setInput("");
      await execute(cmd);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    [input, execute],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(history[idx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < 0) return;
      const idx = histIdx + 1;
      if (idx >= history.length) {
        setHistIdx(-1);
        setInput("");
      } else {
        setHistIdx(idx);
        setInput(history[idx]);
      }
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[320px] rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 font-mono text-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900">
        <span className="text-emerald-400 text-xs">
          {initialized ? `git (${branch})` : "sandbox"} — {cwd}
        </span>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded hover:bg-zinc-800"
        >
          reset
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto p-3 space-y-1"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={
              line.kind === "command"
                ? "text-yellow-300"
                : line.kind === "error"
                  ? "text-red-400"
                  : "text-zinc-300"
            }
          >
            {line.kind === "command" ? (
              <span>
                <span className="text-emerald-400">{cwd} </span>
                <span className="text-zinc-500">$ </span>
                {line.text}
              </span>
            ) : (
              <pre className="whitespace-pre-wrap break-all">{line.text}</pre>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2 border-t border-zinc-800 bg-zinc-900"
      >
        <span className="text-emerald-400 shrink-0">{cwd}</span>
        <span className="text-zinc-500 shrink-0">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none text-zinc-100 placeholder-zinc-600"
          placeholder="git init, git status, …"
          spellCheck={false}
          autoComplete="off"
        />
      </form>
    </div>
  );
}
