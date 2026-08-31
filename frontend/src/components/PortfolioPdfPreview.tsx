import React, { useRef } from 'react';
import katex from 'katex';

interface PortfolioPdfPreviewProps {
  content: string;
}

export const PortfolioPdfPreview: React.FC<PortfolioPdfPreviewProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Sanitize and render
  const renderContent = () => {
    // 1. Regex Sanitize: Clean up unparseable or dangling math structural tokens
    let sanitized = content.replace(/\\\(\s*\\\)/g, ''); // empty \( \)
    
    // Replace inline latex with html spans
    const latexRegex = /\\\((.*?)\\\)/g;
    const parts = [];
    let lastIndex = 0;
    
    let match;
    while ((match = latexRegex.exec(sanitized)) !== null) {
      if (match.index > lastIndex) {
        parts.push(sanitized.substring(lastIndex, match.index));
      }
      
      const math = match[1];
      try {
        // KaTeX Fallback: try to render
        const rendered = katex.renderToString(math, {
          throwOnError: true,
          displayMode: false
        });
        parts.push(`<span class="math-rendered">${rendered}</span>`);
      } catch (err) {
        // Fallback to rendering the raw text string wrapped in a standard <code> or <span> tag
        parts.push(`<code class="math-fallback">\\(${math}\\)</code>`);
      }
      lastIndex = latexRegex.lastIndex;
    }
    
    if (lastIndex < sanitized.length) {
      parts.push(sanitized.substring(lastIndex));
    }
    
    return { __html: parts.join('') };
  };

  return (
    <div className="portfolio-pdf-preview" ref={containerRef}>
      <div 
        className="content-body" 
        dangerouslySetInnerHTML={renderContent()} 
      />
    </div>
  );
};
