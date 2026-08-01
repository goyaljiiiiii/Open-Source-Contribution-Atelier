/**
 * Client-side Git engine with isomorphic-git-like API surface.
 *
 * Uses pure TypeScript state persisted via VirtualFileSystem.
 * Optionally delegates to `isomorphic-git` when dynamically importable
 * (e.g. after a future WASM bundle is added — no npm dep required today).
 */

import { VirtualFileSystem } from "./virtualFileSystem";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface GitDagNode {
  oid: string;
  message: string;
  author: string;
  timestamp: number;
  parents: string[];
  branch?: string;
}

export interface GitStatusEntry {
  path: string;
  staged: boolean;
  modified: boolean;
  untracked: boolean;
}

interface GitCommit {
  oid: string;
  message: string;
  author: string;
  timestamp: number;
  parents: string[];
  tree: Record<string, string>;
}

interface GitRepoState {
  initialized: boolean;
  head: string | null;
  branch: string;
  branches: Record<string, string | null>;
  index: Record<string, string>;
  commits: Record<string, GitCommit>;
  workingTree: Record<string, string>;
  cherryPickHead?: string | null;
  rebaseOnto?: string | null;
}

const STATE_PATH = "/.git/state.json";
const DEFAULT_AUTHOR = "sandbox <sandbox@atelier.local>";

function shortOid(): string {
  return Math.random().toString(16).slice(2, 9);
}

function parseArgs(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote: '"' | "'" | null = null;
  for (const ch of input) {
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class GitWasmEngine {
  private vfs: VirtualFileSystem;
  private state: GitRepoState;
  private isoGit: Record<string, unknown> | null = null;
  private ready: Promise<void>;

  constructor(vfs?: VirtualFileSystem) {
    this.vfs = vfs ?? new VirtualFileSystem();
    this.state = this.emptyState();
    this.ready = this.bootstrap();
  }

  private emptyState(): GitRepoState {
    return {
      initialized: false,
      head: null,
      branch: "main",
      branches: { main: null },
      index: {},
      commits: {},
      workingTree: {},
    };
  }

  private async bootstrap(): Promise<void> {
    await this.vfs.init();
    try {
      const raw = (await this.vfs.readFile(STATE_PATH, {
        encoding: "utf8",
      })) as string;
      this.state = JSON.parse(raw) as GitRepoState;
    } catch {
      // fresh repo
    }
    await this.tryLoadIsoGit();
  }

  /** Attempt dynamic import of isomorphic-git if present in the bundle. */
  private async tryLoadIsoGit(): Promise<void> {
    try {
      this.isoGit = await import(/* @vite-ignore */ "isomorphic-git");
    } catch {
      this.isoGit = null;
    }
  }

  private async persist(): Promise<void> {
    const exists = await this.vfs.exists("/.git");
    if (!exists) await this.vfs.mkdir("/.git");
    await this.vfs.writeFile(STATE_PATH, JSON.stringify(this.state, null, 2));
  }

  private commitToNode(c: GitCommit): GitDagNode {
    return {
      oid: c.oid,
      message: c.message,
      author: c.author,
      timestamp: c.timestamp,
      parents: c.parents,
      branch: this.state.branch,
    };
  }

  // ─── isomorphic-git-like API ──────────────────────────────────────────────

  async init(): Promise<void> {
    await this.ready;
    this.state = { ...this.emptyState(), initialized: true };
    await this.vfs.mkdir("/.git");
    await this.persist();
  }

  async add(filepath: string): Promise<void> {
    await this.ready;
    if (!this.state.initialized) throw new Error("not a git repository");
    const norm = filepath.startsWith("/") ? filepath : `/${filepath}`;
    const content = (await this.vfs.readFile(norm, {
      encoding: "utf8",
    })) as string;
    this.state.index[norm] = content;
    this.state.workingTree[norm] = content;
    await this.persist();
  }

  async commit(opts: { message: string; author?: string }): Promise<string> {
    await this.ready;
    if (!this.state.initialized) throw new Error("not a git repository");
    if (Object.keys(this.state.index).length === 0) {
      throw new Error("nothing to commit");
    }
    const oid = shortOid();
    const parent = this.state.head;
    const commit: GitCommit = {
      oid,
      message: opts.message,
      author: opts.author ?? DEFAULT_AUTHOR,
      timestamp: Date.now(),
      parents: parent ? [parent] : [],
      tree: { ...this.state.index },
    };
    this.state.commits[oid] = commit;
    this.state.head = oid;
    this.state.branches[this.state.branch] = oid;
    this.state.index = {};
    await this.persist();
    return oid;
  }

  async branch(args: { ref: string; checkout?: boolean }): Promise<void> {
    await this.ready;
    if (!this.state.initialized) throw new Error("not a git repository");
    this.state.branches[args.ref] = this.state.head;
    if (args.checkout) {
      this.state.branch = args.ref;
      if (this.state.head && this.state.commits[this.state.head]) {
        this.state.workingTree = {
          ...this.state.commits[this.state.head].tree,
        };
        for (const [p, c] of Object.entries(this.state.workingTree)) {
          await this.vfs.writeFile(p, c);
        }
      }
    }
    await this.persist();
  }

  async checkout(ref: string): Promise<void> {
    await this.ready;
    if (!this.state.initialized) throw new Error("not a git repository");
    if (this.state.branches[ref] !== undefined) {
      this.state.branch = ref;
      this.state.head = this.state.branches[ref];
    } else if (this.state.commits[ref]) {
      this.state.head = ref;
    } else {
      throw new Error(`pathspec '${ref}' did not match any file(s) known to git`);
    }
    if (this.state.head && this.state.commits[this.state.head]) {
      const tree = this.state.commits[this.state.head].tree;
      this.state.workingTree = { ...tree };
      for (const [p, c] of Object.entries(tree)) {
        await this.vfs.writeFile(p, c);
      }
    }
    await this.persist();
  }

  async status(): Promise<GitStatusEntry[]> {
    await this.ready;
    const entries: GitStatusEntry[] = [];
    const allPaths = new Set([
      ...Object.keys(this.state.workingTree),
      ...Object.keys(this.state.index),
    ]);
    const vfsFiles = await this.vfs.listAllFiles();
    for (const f of vfsFiles) {
      if (f.startsWith("/.git")) continue;
      allPaths.add(f);
    }
    for (const path of allPaths) {
      if (path.startsWith("/.git")) continue;
      let content = "";
      try {
        content = (await this.vfs.readFile(path, {
          encoding: "utf8",
        })) as string;
      } catch {
        /* missing */
      }
      const inIndex = path in this.state.index;
      const inTree = path in this.state.workingTree;
      const modified = inTree && this.state.workingTree[path] !== content;
      const untracked = !inTree && !inIndex && content.length > 0;
      entries.push({
        path,
        staged: inIndex,
        modified,
        untracked,
      });
    }
    return entries;
  }

  async log(): Promise<GitCommit[]> {
    await this.ready;
    const result: GitCommit[] = [];
    let current = this.state.head;
    const seen = new Set<string>();
    while (current && this.state.commits[current] && !seen.has(current)) {
      seen.add(current);
      result.push(this.state.commits[current]);
      current = this.state.commits[current].parents[0] ?? null;
    }
    return result;
  }

  /** Simplified merge: fast-forward or create merge commit with both parents. */
  async merge(ref: string): Promise<string> {
    await this.ready;
    const targetOid =
      this.state.branches[ref] ??
      (this.state.commits[ref] ? ref : null);
    if (!targetOid) throw new Error(`merge: ref '${ref}' not found`);
    const ours = this.state.head;
    if (!ours) throw new Error("merge: no HEAD commit");

    const theirs = this.state.commits[targetOid];
    if (!theirs) throw new Error(`merge: invalid commit ${targetOid}`);

    // Fast-forward
    if (theirs.parents.includes(ours)) {
      this.state.head = targetOid;
      this.state.branches[this.state.branch] = targetOid;
      this.state.workingTree = { ...theirs.tree };
      for (const [p, c] of Object.entries(theirs.tree)) {
        await this.vfs.writeFile(p, c);
      }
      await this.persist();
      return targetOid;
    }

    const mergedTree = { ...this.state.commits[ours].tree, ...theirs.tree };
    const oid = shortOid();
    const commit: GitCommit = {
      oid,
      message: `Merge branch '${ref}'`,
      author: DEFAULT_AUTHOR,
      timestamp: Date.now(),
      parents: [ours, targetOid],
      tree: mergedTree,
    };
    this.state.commits[oid] = commit;
    this.state.head = oid;
    this.state.branches[this.state.branch] = oid;
    this.state.workingTree = { ...mergedTree };
    for (const [p, c] of Object.entries(mergedTree)) {
      await this.vfs.writeFile(p, c);
    }
    await this.persist();
    return oid;
  }

  /** Simplified cherry-pick: apply target commit tree on current HEAD. */
  async cherryPick(ref: string): Promise<string> {
    await this.ready;
    const pickOid =
      ref in this.state.commits
        ? ref
        : Object.values(this.state.commits).find((c) => c.oid.startsWith(ref))
            ?.oid;
    if (!pickOid) throw new Error(`cherry-pick: bad revision '${ref}'`);
    const picked = this.state.commits[pickOid];
    const parent = this.state.head;
    const oid = shortOid();
    const commit: GitCommit = {
      oid,
      message: picked.message,
      author: picked.author,
      timestamp: Date.now(),
      parents: parent ? [parent] : [],
      tree: { ...picked.tree },
    };
    this.state.commits[oid] = commit;
    this.state.head = oid;
    this.state.branches[this.state.branch] = oid;
    this.state.workingTree = { ...picked.tree };
    for (const [p, c] of Object.entries(picked.tree)) {
      await this.vfs.writeFile(p, c);
    }
    await this.persist();
    return oid;
  }

  /** Simplified linear rebase onto target branch tip. */
  async rebase(onto: string): Promise<void> {
    await this.ready;
    const ontoOid =
      this.state.branches[onto] ??
      (this.state.commits[onto] ? onto : null);
    if (!ontoOid) throw new Error(`rebase: onto '${onto}' not found`);

    const commits: GitCommit[] = [];
    let cur = this.state.head;
    while (cur && cur !== ontoOid) {
      const c = this.state.commits[cur];
      if (!c) break;
      commits.unshift(c);
      cur = c.parents[0] ?? null;
    }

    let parent = ontoOid;
    for (const c of commits) {
      const oid = shortOid();
      const rebased: GitCommit = {
        ...c,
        oid,
        parents: parent ? [parent] : [],
        timestamp: Date.now(),
      };
      this.state.commits[oid] = rebased;
      parent = oid;
    }
    if (parent && parent !== ontoOid) {
      this.state.head = parent;
      this.state.branches[this.state.branch] = parent;
      const tip = this.state.commits[parent];
      this.state.workingTree = { ...tip.tree };
      for (const [p, c] of Object.entries(tip.tree)) {
        await this.vfs.writeFile(p, c);
      }
    }
    await this.persist();
  }

  getDag(): GitDagNode[] {
    return Object.values(this.state.commits).map((c) => this.commitToNode(c));
  }

  getCurrentBranch(): string {
    return this.state.branch;
  }

  getVfs(): VirtualFileSystem {
    return this.vfs;
  }

  isInitialized(): boolean {
    return this.state.initialized;
  }

  /** Parse and execute a shell-style git command string. */
  async execute(command: string): Promise<string[]> {
    await this.ready;
    const trimmed = command.trim();
    if (!trimmed) return [];

    const tokens = parseArgs(trimmed);
    const [bin, sub, ...rest] = tokens;
    if (bin !== "git") {
      return [`${bin}: command not found`];
    }

    try {
      switch (sub) {
        case "init": {
          await this.init();
          return ["Initialized empty Git repository in /.git/"];
        }
        case "add": {
          const path = rest[0] ?? ".";
          if (path === ".") {
            const files = await this.vfs.listAllFiles();
            for (const f of files) {
              if (!f.startsWith("/.git")) await this.add(f);
            }
          } else {
            await this.add(path.startsWith("/") ? path : `/${path}`);
          }
          return [];
        }
        case "commit": {
          let message = "empty commit";
          const mIdx = rest.indexOf("-m");
          if (mIdx >= 0 && rest[mIdx + 1]) message = rest[mIdx + 1];
          const oid = await this.commit({ message });
          return [`[${this.state.branch} ${oid}] ${message}`];
        }
        case "status": {
          const entries = await this.status();
          if (!this.state.initialized) return ["fatal: not a git repository"];
          const lines = [`On branch ${this.state.branch}`];
          const staged = entries.filter((e) => e.staged);
          const modified = entries.filter((e) => e.modified && !e.staged);
          const untracked = entries.filter((e) => e.untracked);
          if (staged.length) {
            lines.push("\nChanges to be committed:");
            staged.forEach((e) => lines.push(`  new file:   ${e.path}`));
          }
          if (modified.length) {
            lines.push("\nChanges not staged for commit:");
            modified.forEach((e) => lines.push(`  modified:   ${e.path}`));
          }
          if (untracked.length) {
            lines.push("\nUntracked files:");
            untracked.forEach((e) => lines.push(`  ${e.path}`));
          }
          if (!staged.length && !modified.length && !untracked.length) {
            lines.push("\nnothing to commit, working tree clean");
          }
          return lines;
        }
        case "log": {
          const commits = await this.log();
          return commits.map(
            (c) =>
              `commit ${c.oid}\nAuthor: ${c.author}\nDate: ${new Date(c.timestamp).toISOString()}\n\n    ${c.message}\n`,
          );
        }
        case "branch": {
          if (rest[0] === "-M" || rest[0] === "-m") {
            const name = rest[1] ?? "main";
            const tip = this.state.branches[this.state.branch];
            delete this.state.branches[this.state.branch];
            this.state.branch = name;
            this.state.branches[name] = tip;
            await this.persist();
            return [];
          }
          if (rest.length === 0) {
            return Object.keys(this.state.branches).map((b) =>
              b === this.state.branch ? `* ${b}` : `  ${b}`,
            );
          }
          await this.branch({ ref: rest[0], checkout: false });
          return [];
        }
        case "checkout": {
          const ref = rest[0];
          if (!ref) return ["fatal: you must specify a branch"];
          if (ref === "-b" && rest[1]) {
            await this.branch({ ref: rest[1], checkout: true });
            return [`Switched to a new branch '${rest[1]}'`];
          }
          await this.checkout(ref);
          return [`Switched to branch '${ref}'`];
        }
        case "merge": {
          const ref = rest[0];
          if (!ref) return ["fatal: you must specify a branch"];
          const oid = await this.merge(ref);
          return [`Merge made by the 'ort' strategy. (${oid})`];
        }
        case "cherry-pick": {
          const ref = rest[0];
          if (!ref) return ["fatal: you must specify a commit"];
          const oid = await this.cherryPick(ref);
          return [`[${this.state.branch} ${oid}] cherry-pick completed`];
        }
        case "rebase": {
          const ontoIdx = rest.indexOf("--onto");
          const onto = ontoIdx >= 0 ? rest[ontoIdx + 1] : rest[rest.length - 1];
          if (!onto) return ["fatal: no onto branch specified"];
          await this.rebase(onto);
          return [`Successfully rebased and updated refs/heads/${this.state.branch}.`];
        }
        default:
          return [`git: '${sub}' is not a git command.`];
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return [`error: ${msg}`];
    }
  }
}
