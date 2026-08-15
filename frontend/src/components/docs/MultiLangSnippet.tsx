import React, { useState, useEffect } from "react";
import { CodeBlock } from "./CodeBlock";

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
  const [activeLang, setActiveLang] = useState<SnippetLanguage>("js");

  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY) as SnippetLanguage;
    if (saved && snippets[saved]) {
      setActiveLang(saved);
    } else {
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
    window.dispatchEvent(
      new CustomEvent("snippetLangChange", { detail: { lang } })
    );
  };

  const currentCode = snippets[activeLang] || "";

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
    <div className="my-4 rounded-xl overflow-hidden border border-slate-800 bg-[#0d0f17] shadow-lg">
      <div className="flex border-b border-slate-800 bg-[#131622] overflow-x-auto">
        {availableLanguages.map((lang) => (
          <button
            key={lang}
            onClick={() => handleLangSelect(lang)}
            className={`px-4 py-2.5 text-xs font-mono font-bold transition-colors whitespace-nowrap ${
              activeLang === lang
                ? "bg-[#1c2030] text-indigo-400 border-b-2 border-indigo-500"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            {getLanguageLabel(lang)}
          </button>
        ))}
      </div>
      <CodeBlock
        code={currentCode}
        language={activeLang === "curl" ? "bash" : activeLang === "js" ? "javascript" : "python"}
        showLineNumbers={true}
      />
    </div>
  );
};
