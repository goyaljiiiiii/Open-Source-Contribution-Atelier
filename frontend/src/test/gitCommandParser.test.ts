import { describe, expect, it } from "vitest";
import {
  makeInitialState,
  runCommand,
  type ShellState,
} from "../hooks/useGitShell";

function run(state: ShellState, raw: string, lineId = { v: 1 }) {
  return runCommand(raw, state, lineId);
}

describe("sandbox git command parser", () => {
  it("ignores empty input and trailing whitespace", () => {
    const state = makeInitialState();
    const lineId = { v: 1 };

    expect(run(state, "", lineId).lines).toEqual([]);
    expect(run(state, "   ", lineId).lines).toEqual([]);
  });

  it("reports unknown top-level commands", () => {
    const result = run(makeInitialState(), "frobnicate");
    expect(result.lines.at(-1)?.text).toContain("command not found");
  });

  it("accepts git commands case-insensitively", () => {
    let state = makeInitialState();
    state = run(state, "GIT INIT").newState;
    const result = run(state, "GIT STATUS   ");

    expect(
      result.lines.some((line) => line.text.includes("On branch main")),
    ).toBe(true);
  });

  it("keeps quoted commit messages as a single argument", () => {
    let state = makeInitialState();
    state = run(state, "git init").newState;
    state = run(state, "touch app.js").newState;
    state = run(state, "git add app.js").newState;
    state = run(state, "git commit -m 'initial commit with spaces'").newState;

    expect(state.git.commits).toHaveLength(1);
    expect(state.git.commits[0].message).toBe("initial commit with spaces");
  });

  it("tokenizes branch creation flags for switch and checkout", () => {
    let state = makeInitialState();
    state = run(state, "git init").newState;
    state = run(state, "git switch -c feat/one").newState;

    expect(state.git.currentBranch).toBe("feat/one");
    expect(state.git.branches["feat/one"]).toBeDefined();

    state = run(state, "git checkout -b feat/two").newState;

    expect(state.git.currentBranch).toBe("feat/two");
    expect(state.git.branches["feat/two"]).toBeDefined();
  });

  it("reports unknown git subcommands", () => {
    let state = makeInitialState();
    state = run(state, "git init").newState;
    const result = run(state, "git frobnicate");

    expect(result.lines.at(-1)?.text).toContain("not a git command");
  });
});
