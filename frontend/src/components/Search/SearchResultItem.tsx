import React from 'react';

interface SearchResultItemProps {
  title: string;
  snippet: string;
  searchQuery: string;
}

export function SearchResultItem({ title, snippet, searchQuery }: SearchResultItemProps) {
  
  // Safely escapes special regex characters to prevent runtime crashing injection attacks
  const escapeRegExp = (text: string) => {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  };

  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;

    const escapedQuery = escapeRegExp(query.trim());
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, index) => 
          regex.test(part) ? (
            <mark 
              key={index} 
              className="bg-yellow-500/20 text-yellow-300 dark:bg-yellow-400/30 rounded px-0.5 border border-yellow-500/20"
            >
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </>
    );
  };

  return (
    <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl hover:border-slate-700/60 transition-all duration-200">
      <h3 className="text-base font-bold text-white mb-1">
        {renderHighlightedText(title, searchQuery)}
      </h3>
      <p className="text-sm text-slate-400 leading-relaxed">
        {renderHighlightedText(snippet, searchQuery)}
      </p>
    </div>
  );
}

export default SearchResultItem;
