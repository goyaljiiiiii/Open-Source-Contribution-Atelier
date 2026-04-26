export interface Lesson {
  slug: string; // used for URL
  title: string;
  description: string;
  explanation: string; // markdown or plain text
  expected: RegExp; // validation pattern
  hint: string;
  tips?: string[]; // optional tips/mistakes guidance
}

export const lessons: Lesson[] = [
  // Intro lesson – why learn Git & GitHub
  {
    slug: "intro",
    title: "Why Git & GitHub?",
    description: "Understand the importance of version control and collaboration.",
    explanation: "Git lets you track changes, revert mistakes, and work on multiple features safely. GitHub adds a social layer: sharing, reviewing, and contributing to open‑source projects.",
    expected: /.+/, // any answer accepted – just press Enter
    hint: "Press Enter to continue.",
    tips: [
      "Version control prevents loss of work.",
      "Collaboration is easier with pull requests.",
      "Open‑source contributions boost your portfolio.",
    ],
  },
  {
    slug: "git-init",
    title: "Initialize a Repository",
    description: "Create a new Git repository.",
    explanation: "The `git init` command creates a .git folder and starts tracking.",
    expected: /^git\s+init$/i,
    hint: "Make sure you type `git` followed by a space and `init`.",
    tips: [
      "Common mistake: forgetting the space (`gitinit`).",
      "Tip: Run `git status` after init to see the repo state.",
    ],
  },
  {
    slug: "git-add",
    title: "Stage Files",
    description: "Add files to the staging area.",
    explanation: "`git add <file>` tells Git to include changes in the next commit.",
    expected: /^git\s+add\s+.+$/i,
    hint: "You need to specify a file name after `git add`.",
    tips: [
      "Mistake: using `git add .` without checking what’s added.",
      "Tip: Use `git status` to review staged files before committing.",
    ],
  },
  {
    slug: "git-commit",
    title: "Create a Commit",
    description: "Record your changes.",
    explanation: "`git commit -m \"msg\"` creates a new commit with a message.",
    expected: /^git\s+commit\s+-m\s+\".+\"$/i,
    hint: "Remember the `-m` flag and wrap the message in quotes.",
    tips: [
      "Bad practice: vague commit messages like `update`.",
      "Tip: Write concise, imperative messages (e.g., `Add login component`).",
    ],
  },
  {
    slug: "git-push",
    title: "Push to Remote",
    description: "Send commits to a remote repository.",
    explanation: "`git push origin main` pushes your local main branch.",
    expected: /^git\s+push\s+origin\s+main$/i,
    hint: "Specify both the remote name (`origin`) and the branch (`main`).",
    tips: [
      "Mistake: pushing to the wrong branch and causing conflicts.",
      "Tip: Pull (`git pull`) before pushing to avoid rejected pushes.",
    ],
  },
  {
    slug: "github-pr",
    title: "Open a Pull Request",
    description: "Create a PR on GitHub.",
    explanation: "After pushing a branch, open a PR via the GitHub UI or CLI.",
    expected: /.+/, // any non‑empty answer accepted for demo
    hint: "Describe the steps: push a branch, then click ‘New Pull Request’ on GitHub.",
    tips: [
      "Common error: forgetting to sync your fork before creating a PR.",
      "Tip: Keep your PR focused on a single change for easier review.",
    ],
  },
];
