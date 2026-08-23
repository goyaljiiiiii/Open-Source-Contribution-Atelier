import React from "react";

export interface SkipLinkProps {
  targetId?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SkipLink({
  targetId = "main-content",
  children = "Skip to main content",
  className = "",
}: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
      }
      target.focus();
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={`sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:ring-2 focus:ring-accent focus:rounded-lg font-bold shadow-lg transition-all ${className}`}
    >
      {children}
    </a>
  );
}

export default SkipLink;
