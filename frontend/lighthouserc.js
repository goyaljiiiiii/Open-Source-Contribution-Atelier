module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:5173/",
        "http://localhost:5173/lessons",
        "http://localhost:5173/lessons/git-basics",
        "http://localhost:5173/leaderboard",
        "http://localhost:5173/dashboard",
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: "--no-sandbox --headless --disable-gpu",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.85 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
};
