/**
 * Advanced search bar with autocomplete and debouncing.
 * 
 * @file SearchBar.tsx
 * @location frontend/src/components/Search/SearchBar.tsx
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { search, getSuggestions, SearchFilters } from '../../api/search';
import './SearchBar.css';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  content_type: string;
  difficulty: string;
  tags: string[];
  headline: string;
  rank: number;
}

interface SearchBarProps {
  placeholder?: string;
  onResultClick?: (result: SearchResult) => void;
  filters?: SearchFilters;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search lessons, modules, and more...',
  onResultClick,
  filters = {},
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const suggestionTimer = useRef<NodeJS.Timeout | null>(null);

  // ============================================================
  // Search Logic
  // ============================================================

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await search(searchQuery, filters);
      setResults(response.results);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const fetchSuggestions = useCallback(async (prefix: string) => {
    if (!prefix.trim() || prefix.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const suggestions = await getSuggestions(prefix);
      setSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }, []);

  // ============================================================
  // Debounced Search
  // ============================================================

  useEffect(() => {
    // Clear previous timers
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    if (suggestionTimer.current) {
      clearTimeout(suggestionTimer.current);
    }

    // Fetch suggestions (fast)
    suggestionTimer.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 150);

    // Perform search (slow)
    if (query.length >= 2) {
      debounceTimer.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (suggestionTimer.current) {
        clearTimeout(suggestionTimer.current);
      }
    };
  }, [query, performSearch, fetchSuggestions]);

  // ============================================================
  // Keyboard Navigation
  // ============================================================

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = showSuggestions ? suggestions : results.map(r => r.title);
    const maxIndex = items.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, maxIndex));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && showSuggestions) {
          // Select suggestion
          setQuery(suggestions[selectedIndex]);
          setShowSuggestions(false);
          performSearch(suggestions[selectedIndex]);
        } else if (selectedIndex >= 0 && results.length > 0) {
          // Select result
          onResultClick?.(results[selectedIndex]);
        } else if (query.trim()) {
          // Perform search
          performSearch(query);
        }
        setSelectedIndex(-1);
        break;

      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        if (inputRef.current) {
          inputRef.current.blur();
        }
        break;
    }
  };

  // ============================================================
  // Click Outside
  // ============================================================

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className={`search-container ${className}`} ref={resultsRef}>
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onKeyDown={handleKeyDown}
          aria-label="Search"
          autoComplete="off"
        />
        {isLoading && (
          <span className="search-loading">
            <div className="spinner" />
          </span>
        )}
        {query && (
          <button
            className="search-clear"
            onClick={() => {
              setQuery('');
              setResults([]);
              setSuggestions([]);
              setShowSuggestions(false);
              if (inputRef.current) {
                inputRef.current.focus();
              }
            }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="search-suggestions">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`search-suggestion ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => {
                setQuery(suggestion);
                setShowSuggestions(false);
                performSearch(suggestion);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="suggestion-icon">🔍</span>
              <span className="suggestion-text">{suggestion}</span>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {isFocused && results.length > 0 && (
        <div className="search-results">
          <div className="results-header">
            <span className="results-count">{results.length} results found</span>
          </div>
          {results.map((result, index) => (
            <div
              key={result.id}
              className={`search-result ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => onResultClick?.(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="result-title">
                <span className="result-type">{result.content_type}</span>
                <span className="result-difficulty">{result.difficulty}</span>
              </div>
              <div className="result-headline">
                <span dangerouslySetInnerHTML={{ __html: result.headline || result.description }} />
              </div>
              {result.tags.length > 0 && (
                <div className="result-tags">
                  {result.tags.map((tag, i) => (
                    <span key={i} className="tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="results-footer">
            <button className="view-all-btn">View all results →</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;