import React from 'react';
import { render } from '@testing-library/react';
import { PortfolioPdfPreview } from '../components/PortfolioPdfPreview';
import '@testing-library/jest-dom';

describe('PortfolioPdfPreview', () => {
  it('renders mixed Markdown, LaTeX, and code snippets safely', () => {
    const sampleContent = `
      # Project Title
      Here is some code: \`const a = 1;\`
      And a formula: \\(E=mc^2\\)
      And a broken formula that should fallback: \\(E=mc^2 \\invalidMacro\\)
    `;
    
    const { container } = render(<PortfolioPdfPreview content={sampleContent} />);
    
    // Should contain standard text
    expect(container.textContent).toContain('Project Title');
    
    // Should fallback gracefully for invalid math
    expect(container.querySelector('.math-fallback')).toBeInTheDocument();
  });
});
