import React, { useState } from "react";
import { ChevronDown, HelpCircle, Search, X } from "lucide-react";

type FaqCategory = "All" | "Setup" | "Git Sandbox" | "Certificates" | "Deployment";

interface FaqItem {
  id: string;
  category: Exclude<FaqCategory, "All">;
  question: string;
  answers: string[];
  keywords: string[];
}

const CATEGORY_STYLES: Record<FaqCategory, string> = {
  All: "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white",
  Setup: "bg-sky-200 text-sky-950 border-black",
  "Git Sandbox": "bg-emerald-200 text-emerald-950 border-black",
  Certificates: "bg-violet-200 text-violet-950 border-black",
  Deployment: "bg-amber-200 text-amber-950 border-black",
};

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "setup-local-dev",
    category: "Setup",
    question: "How do I set up the project locally?",
    answers: [
      "Follow the repo guide for both frontend and backend setup, then start the app stack you need for the area you're working on.",
      "The docs intentionally keep the local workflow split so you can verify UI changes, API changes, or both without extra setup.",
    ],
    keywords: ["install", "venv", "npm install", "local environment"],
  },
  {
    id: "setup-db",
    category: "Setup",
    question: "Do I need the database and worker stack running for every docs change?",
    answers: [
      "No. Pure documentation or UI-only work can usually be validated without Postgres or Redis.",
      "If your change touches badges, certificates, or async flows, bring up the full stack so the linked data stays realistic.",
    ],
    keywords: ["postgres", "redis", "workers", "full stack"],
  },
  {
    id: "git-sandbox-flow",
    category: "Git Sandbox",
    question: "What is the fastest way to complete a Git Sandbox exercise?",
    answers: [
      "Read the prompt once, inspect the starting branch, and keep commits small so each checkpoint stays easy to review.",
      "Use the sandbox terminal commands to practice branch, commit, and pull request steps in the same order the exercise expects.",
    ],
    keywords: ["branch", "commit", "pull request", "exercise"],
  },
  {
    id: "git-sandbox-pr",
    category: "Git Sandbox",
    question: "How do I know when the sandbox task is ready to submit?",
    answers: [
      "When the requested git history and file changes match the exercise checklist, you are usually ready to submit.",
      "If a challenge mentions review feedback, make sure the final branch state is clean before opening or updating the PR.",
    ],
    keywords: ["review", "submit", "history", "clean branch"],
  },
  {
    id: "certificates-issued",
    category: "Certificates",
    question: "How are certificates generated and verified?",
    answers: [
      "Certificates are issued after the relevant completion criteria are met, then the verification page checks the stored hash or signature.",
      "If you share a certificate, the verification route should still resolve the underlying record and confirm it has not been revoked.",
    ],
    keywords: ["verification hash", "signature", "issued", "revoked"],
  },
  {
    id: "certificates-badges",
    category: "Certificates",
    question: "What is the relationship between certificates and badges?",
    answers: [
      "Badges track milestone progress, while certificates represent a shareable completion artifact.",
      "In practice, you may unlock badges along the way and then receive a certificate when the larger learning goal is complete.",
    ],
    keywords: ["badges", "milestones", "completion", "progress"],
  },
  {
    id: "deployment-config",
    category: "Deployment",
    question: "What should I check before deploying a docs change?",
    answers: [
      "Make sure the page builds cleanly, the new FAQ search behaves correctly, and the visual hierarchy still matches the rest of the docs stack.",
      "If the change depends on environment variables or backend data, verify the production configuration matches your local assumptions.",
    ],
    keywords: ["build", "environment variables", "production", "release"],
  },
  {
    id: "deployment-routing",
    category: "Deployment",
    question: "Why do some docs links look different in production?",
    answers: [
      "Deployment paths can differ from local dev routes, especially when a page is behind authentication or served from a nested route.",
      "The safest check is to follow the final production URL and confirm the FAQ section still resolves from the docs entry point.",
    ],
    keywords: ["routes", "auth", "docs entry point", "production url"],
  },
];

export function FAQAccordion() {
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredItems = FAQ_ITEMS.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch =
      normalizedQuery === "" ||
      [item.question, item.category, ...item.keywords, ...item.answers]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesCategory && matchesSearch;
  });

  const clearFilters = () => {
    setSelectedCategory("All");
    setQuery("");
    setOpenId(FAQ_ITEMS[0]?.id ?? null);
  };

  return (
    <section className="rounded-[28px] border-4 border-black bg-[#fff8e8] px-4 py-5 shadow-[10px_10px_0_0_rgba(0,0,0,0.9)] dark:border-white dark:bg-zinc-950 md:px-6 md:py-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border-2 border-black bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-black shadow-[3px_3px_0_0_rgba(0,0,0,0.9)] dark:border-white dark:bg-zinc-900 dark:text-white">
              <HelpCircle className="h-3.5 w-3.5" />
              FAQ Explorer
            </div>
            <h2 className="text-2xl font-black tracking-tight text-black dark:text-white md:text-3xl">
              Search the docs without leaving the page
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
              Filter the most common questions by setup, Git Sandbox, certificates, and deployment, then jump straight to the answer you need.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-black md:min-w-[180px]">
            <div className="rounded-2xl border-2 border-black bg-lime-300 px-3 py-2 shadow-[4px_4px_0_0_rgba(0,0,0,0.9)]">
              8 Questions
            </div>
            <div className="rounded-2xl border-2 border-black bg-sky-300 px-3 py-2 shadow-[4px_4px_0_0_rgba(0,0,0,0.9)]">
              Live Filter
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["All", "Setup", "Git Sandbox", "Certificates", "Deployment"] as FaqCategory[]).map((category) => {
              const isActive = selectedCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-transform duration-200 hover:-translate-y-0.5 ${CATEGORY_STYLES[category]} ${isActive ? "shadow-[4px_4px_0_0_rgba(0,0,0,0.95)]" : "shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] opacity-85"}`}
                  aria-pressed={isActive}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search FAQ..."
                aria-label="Search FAQs"
                className="w-full rounded-2xl border-2 border-black bg-white py-3 pl-10 pr-10 text-sm font-medium text-black shadow-[4px_4px_0_0_rgba(0,0,0,0.9)] outline-none transition-transform duration-200 placeholder:text-zinc-500 focus:-translate-y-0.5 dark:border-white dark:bg-zinc-900 dark:text-white"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-black bg-black p-1 text-white transition-transform duration-200 hover:scale-105 dark:border-white dark:bg-white dark:text-black"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-2xl border-2 border-black bg-black px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.9)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-white dark:bg-white dark:text-black"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t-2 border-dashed border-black pt-4 text-xs font-bold uppercase tracking-[0.18em] text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
          <span>{filteredItems.length} matching answers</span>
          {(selectedCategory !== "All" || query) && (
            <span className="rounded-full border-2 border-black bg-white px-3 py-1 text-[10px] text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.8)] dark:border-white dark:bg-zinc-900 dark:text-white">
              Filtering active
            </span>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-[24px] border-2 border-black bg-white px-5 py-6 shadow-[6px_6px_0_0_rgba(0,0,0,0.9)] dark:border-white dark:bg-zinc-900">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-black dark:text-white">
              No FAQs matched your search
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              Try a shorter keyword, switch categories, or reset the filters to bring back the full list.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredItems.map((item, index) => {
              const isOpen = openId === item.id;

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-[24px] border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.9)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-white dark:bg-zinc-900"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${item.id}`}
                    className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left md:px-5"
                  >
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border-2 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${CATEGORY_STYLES[item.category]}`}>
                          {item.category}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                          Question {index + 1}
                        </span>
                      </div>
                      <h3 className="text-base font-black leading-snug text-black dark:text-white md:text-lg">
                        {item.question}
                      </h3>
                    </div>

                    <ChevronDown
                      className={`mt-1 h-5 w-5 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`}
                    />
                  </button>

                  <div
                    id={`faq-panel-${item.id}`}
                    role="region"
                    aria-label={item.question}
                    style={{
                      maxHeight: isOpen ? "280px" : "0px",
                      opacity: isOpen ? 1 : 0,
                    }}
                    className="overflow-hidden border-t-2 border-dashed border-black transition-[max-height,opacity] duration-300 ease-out dark:border-zinc-700"
                  >
                    <div className="px-4 pb-4 pt-3 md:px-5">
                      <div className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {item.answers.map((answer) => (
                          <p key={answer}>{answer}</p>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.keywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-full border-2 border-black bg-[#fff3c4] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.7)] dark:border-white dark:bg-zinc-800 dark:text-white"
                          >
                            #{keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default FAQAccordion;