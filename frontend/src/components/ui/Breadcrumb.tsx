import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { FOCUS_RING } from "../../lib/a11yFocus";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center text-xs font-bold ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-slate-600 dark:text-[#c4bbae]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1 || item.isCurrent;

          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600 shrink-0"
                  aria-hidden="true"
                />
              )}

              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="font-black text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-[300px]"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className={`flex items-center gap-1 text-slate-600 dark:text-[#c4bbae] hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors ${FOCUS_RING}`}
                >
                  {index === 0 && (
                    <Home className="h-3.5 w-3.5 shrink-0" data-testid="home-icon" />
                  )}

                  <span className="truncate max-w-[150px] sm:max-w-[200px]">
                    {item.label}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
