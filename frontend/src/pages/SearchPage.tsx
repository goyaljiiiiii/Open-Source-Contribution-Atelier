import React, { useState } from 'react';
import SearchResultItem from '../components/search/SearchResultItem';

export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mock data representing standard catalog listings
  const [results] = useState([
    { id: 1, title: "Big O Time Complexity Notation", snippet: "Learn how to analyze algorithm performance using mathematical notation and worst-case profiling metrics." },
    { id: 2, title: "Data Structures Foundations", snippet: "An introductory review of linear data architectures, array buffers, stacks, queues, and continuous lists." }
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-xl font-bold tracking-tight">Curriculum Search Workspace</h1>
        <div className="mt-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lessons, terms, or algorithms..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </header>

      <main className="space-y-4">
        {results.map((item) => (
          <SearchResultItem
            key={item.id}
            title={item.title}
            snippet={item.snippet}
            searchQuery={searchQuery}
          />
        ))}
      </main>
    </div>
  );
}

export default SearchPage;
