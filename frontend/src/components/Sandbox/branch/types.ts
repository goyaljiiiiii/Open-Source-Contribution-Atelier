export interface BranchCommit {
  id: string;
  message: string;
  branch: string;
  x: number;
  y: number;
  parentIds: string[];
  mergeParentIds?: string[];
}

export interface BranchLine {
  id: string;
  name: string;
  color: string;
  isHead?: boolean;
}

export interface BranchExercise {
  id: number;
  title: string;
  description: string;
  hint: string;
  requiredCmdPrefix: string;
  completed: boolean;
  xp: number;
  category: "branch" | "merge" | "rebase" | "cherry-pick" | "stash";
}

export interface BranchSimState {
  commits: BranchCommit[];
  branches: BranchLine[];
  currentBranch: string;
  headCommitId: string;
  detachedHead: boolean;
  stash: string[];
  workingChanges: string[];
}

export const BRANCH_COLORS: Record<string, string> = {
  main: "#22c55e",
  "feature/auth": "#3b82f6",
  "feature/ui": "#a855f7",
  "hotfix/bug-1": "#ef4444",
  "release/v1": "#f59e0b",
};

export const INITIAL_BRANCH_STATE: BranchSimState = {
  commits: [
    {
      id: "c1",
      message: "Initial commit: project setup",
      branch: "main",
      x: 400,
      y: 60,
      parentIds: [],
    },
    {
      id: "c2",
      message: "Add package.json and config",
      branch: "main",
      x: 400,
      y: 140,
      parentIds: ["c1"],
    },
    {
      id: "c3",
      message: "Create basic project structure",
      branch: "main",
      x: 400,
      y: 220,
      parentIds: ["c2"],
    },
  ],
  branches: [
    { id: "main", name: "main", color: BRANCH_COLORS.main, isHead: true },
  ],
  currentBranch: "main",
  headCommitId: "c3",
  detachedHead: false,
  stash: [],
  workingChanges: ["README.md updated", "package.json modified"],
};

export const INITIAL_EXERCISES: BranchExercise[] = [
  {
    id: 1,
    title: "Create a Feature Branch",
    description:
      "Create a new branch called 'feature/auth' to add authentication.",
    hint: "git checkout -b feature/auth",
    requiredCmdPrefix: "git checkout -b feature/auth",
    completed: false,
    xp: 50,
    category: "branch",
  },
  {
    id: 2,
    title: "Make a Commit on Feature Branch",
    description:
      "Make a commit on your feature branch with message 'Add login form'.",
    hint: "git commit -m 'Add login form'",
    requiredCmdPrefix: "git commit -m",
    completed: false,
    xp: 50,
    category: "branch",
  },
  {
    id: 3,
    title: "Switch Back to Main",
    description: "Switch back to the main branch.",
    hint: "git checkout main",
    requiredCmdPrefix: "git checkout main",
    completed: false,
    xp: 25,
    category: "branch",
  },
  {
    id: 4,
    title: "Create a Second Feature Branch",
    description:
      "Create another branch called 'feature/ui' for UI work.",
    hint: "git checkout -b feature/ui",
    requiredCmdPrefix: "git checkout -b feature/ui",
    completed: false,
    xp: 50,
    category: "branch",
  },
  {
    id: 5,
    title: "Commit on UI Branch",
    description: "Commit 'Add sidebar component' on the UI branch.",
    hint: "git commit -m 'Add sidebar component'",
    requiredCmdPrefix: "git commit -m",
    completed: false,
    xp: 50,
    category: "branch",
  },
  {
    id: 6,
    title: "Merge Feature Branch",
    description:
      "Switch to main and merge 'feature/auth' into main.",
    hint: "First: git checkout main, then: git merge feature/auth",
    requiredCmdPrefix: "git merge feature/auth",
    completed: false,
    xp: 75,
    category: "merge",
  },
  {
    id: 7,
    title: "Rebase Feature UI Branch",
    description:
      "Switch to feature/ui and rebase it onto main.",
    hint: "First: git checkout feature/ui, then: git rebase main",
    requiredCmdPrefix: "git rebase main",
    completed: false,
    xp: 100,
    category: "rebase",
  },
  {
    id: 8,
    title: "Cherry-Pick a Commit",
    description:
      "Switch to main and cherry-pick the latest UI commit.",
    hint: "git cherry-pick <commit-hash>",
    requiredCmdPrefix: "git cherry-pick",
    completed: false,
    xp: 100,
    category: "cherry-pick",
  },
  {
    id: 9,
    title: "Stash Working Changes",
    description: "Stash your current working changes temporarily.",
    hint: "git stash",
    requiredCmdPrefix: "git stash",
    completed: false,
    xp: 50,
    category: "stash",
  },
  {
    id: 10,
    title: "Apply Stash",
    description: "Apply your stashed changes back.",
    hint: "git stash pop",
    requiredCmdPrefix: "git stash pop",
    completed: false,
    xp: 50,
    category: "stash",
  },
];
