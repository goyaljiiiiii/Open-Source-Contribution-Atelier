import React, { useState, useRef, useEffect } from "react";
import { HelpCircle, X, Sparkles } from "lucide-react";

interface SearchSyntaxHelpPopoverProps {
  onApplySyntax?: (syntax: string) => void;
}

export const SEARCH_OPERATORS = [
  {
    syntax: 'tag:python',
    description: 'Filter lessons by specific tag',
    example: 'tag:git',
  },
  {
    syntax: 'category:backend',
    description: 'Filter by lesson category',
    example: 'category:security',
  },
  {
    syntax: '"exact phrase"',
    description: 'Search for exact matching phrase',
    example: '"merge conflict"',
  },
  {
    syntax: '-keyword',
    description: 'Exclude results containing keyword',
    example: 'react -native',
  },
  {
    syntax: 'level:beginner',
    description: 'Filter by difficulty level (beginner, intermediate, advanced)',
    example: 'level:intermediate',
  },
  {
    syntax: 'author:johndoe',
    description: 'Filter by contributor or author username',
    example: 'author:nandini',
  },
];

export const SearchSyntaxHelpPopover: React.FC<SearchSyntaxHelpPopoverProps> = ({
  onApplySyntax,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleInsert = (syntax: string) => {
    if (onApplySyntax) {
      onApplySyntax(syntax);
    }
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border-2 border-black rounded-lg shadow-sm hover:bg-yellow-50 active:translate-y-0.5 transition-all"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="search-syntax-popover"
        aria-label="Search operator syntax help"
        title="Search operators syntax guide"
      >
        <HelpCircle size={15} className="text-yellow-600" aria-hidden="true" />
        <span>Syntax Help</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          id="search-syntax-popover"
          role="dialog"
          aria-label="Search Query Operators Guide"
          className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-xl border-4 border-black bg-white p-4 shadow-xl text-black animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b-2 border-gray-100 pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <Sparkles size={16} className="text-primary" />
              <h3 className="font-extrabold text-sm uppercase tracking-wide">
                Search Operators
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
              className="p-1 text-gray-500 hover:text-black rounded-md hover:bg-gray-100"
              aria-label="Close syntax guide"
            >
              <X size={16} />
            </button>
          </div>

          <p className="text-xs text-gray-600 mb-3">
            Use these special syntax prefixes to narrow down your search results faster:
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {SEARCH_OPERATORS.map((op) => (
              <div
                key={op.syntax}
                className="group flex flex-col p-2 rounded-lg border border-gray-200 hover:border-black hover:bg-yellow-50/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <code className="text-xs font-mono font-bold bg-gray-100 text-indigo-700 px-1.5 py-0.5 rounded border border-gray-300 group-hover:border-black">
                    {op.syntax}
                  </code>
                  {onApplySyntax && (
                    <button
                      type="button"
                      onClick={() => handleInsert(op.example)}
                      className="text-[11px] font-bold text-primary hover:underline"
                      title={`Insert example: ${op.example}`}
                    >
                      Try: {op.example}
                    </button>
                  )}
                </div>
                <span className="text-xs text-gray-600 mt-1">
                  {op.description}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-500 text-center">
            Tip: Combine multiple operators like{" "}
            <code className="font-mono bg-gray-100 px-1 rounded">tag:git level:beginner</code>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchSyntaxHelpPopover;
