import React, { useState, useEffect } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/themes/prism-tomorrow.css"; // Dark theme

export type SnippetLanguage = "js" | "python" | "curl" | "django";

interface Snippets {
  js?: string;
  python?: string;
  curl?: string;
  django?: string;
}

interface MultiLangSnippetProps {
  snippets: Snippets;
}

const LANGUAGE_KEY = "preferred_snippet_lang";

export const MultiLangSnippet: React.FC<MultiLangSnippetProps> = ({
  snippets,
}) => {
  // Sync globally using localStorage and a custom event
  const [activeLang, setActiveLang] = useState<SnippetLanguage>("js");

  useEffect(() => {
    // Read initial preference
    const saved = localStorage.getItem(LANGUAGE_KEY) as SnippetLanguage;
    if (saved && snippets[saved]) {
      setActiveLang(saved);
    } else {
      // Fallback to first available snippet
      const available = (Object.keys(snippets) as SnippetLanguage[]).find(
        (key) => snippets[key]
      );
      if (available) setActiveLang(available);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LANGUAGE_KEY && e.newValue) {
        if (snippets[e.newValue as SnippetLanguage]) {
          setActiveLang(e.newValue as SnippetLanguage);
        }
      }
    };

    // Custom event for same-tab global synchronization
    const handleCustomChange = (e: CustomEvent<{ lang: SnippetLanguage }>) => {
      if (snippets[e.detail.lang]) {
        setActiveLang(e.detail.lang);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("snippetLangChange" as any, handleCustomChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("snippetLangChange" as any, handleCustomChange);
    };
  }, [snippets]);

  const handleLangSelect = (lang: SnippetLanguage) => {
    setActiveLang(lang);
    localStorage.setItem(LANGUAGE_KEY, lang);
    // Dispatch event so other snippets on the same page update immediately
    window.dispatchEvent(
      new CustomEvent("snippetLangChange", { detail: { lang } })
    );
  };

  const currentCode = snippets[activeLang] || "";

  // Highlight using Prism
  const getHighlightedCode = () => {
    let grammar = Prism.languages.javascript;
    if (activeLang === "python" || activeLang === "django") {
      grammar = Prism.languages.python;
    } else if (activeLang === "curl") {
      grammar = Prism.languages.bash;
    }

    if (!grammar) return currentCode;
    return Prism.highlight(currentCode, grammar, activeLang);
  };

  const getLanguageLabel = (lang: SnippetLanguage) => {
    switch (lang) {
      case "js":
        return "JavaScript (fetch)";
      case "python":
        return "Python (requests)";
      case "curl":
        return "cURL";
      case "django":
        return "Django Client";
      default:
        return lang;
    }
  };

  const availableLanguages = Object.keys(snippets) as SnippetLanguage[];

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-lg">
      <div className="flex border-b border-slate-800 bg-slate-900 overflow-x-auto">
        {availableLanguages.map((lang) => (
          <button
            key={lang}
            onClick={() => handleLangSelect(lang)}
            className={`px-4 py-2.5 text-xs font-mono font-medium transition-colors whitespace-nowrap ${
              activeLang === lang
                ? "bg-slate-800 text-indigo-400 border-b-2 border-indigo-500"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            {getLanguageLabel(lang)}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="p-4 overflow-x-auto text-sm font-mono text-slate-300 bg-transparent m-0">
          <code dangerouslySetInnerHTML={{ __html: getHighlightedCode() }} />
        </pre>
      </div>
    </div>
  );
};
