# Code Block ARIA Region & Landmark Guidelines

## 1. Context and Problem
Lessons on `LessonPage.tsx` and across the documentation platform render multiple interactive code snippet blocks. Previously, code block containers lacked landmark region markup (`role="region"` and `aria-label`). Screen reader users navigating structured technical content were forced to read through hundreds of raw token lines without the ability to jump between code snippets or bypass code blocks to continue reading narrative explanations.

## 2. Solution and Accessibility Standards
To satisfy **WCAG 2.1 Success Criterion 1.3.1 (Info and Relationships)** and **2.4.1 (Bypass Blocks)**:
1. **ARIA Landmark Region**: Container elements in `CodeBlock.tsx` specify `role="region"`.
2. **Dynamic Descriptive Label**: Each code block sets `aria-label={`Code snippet: ${language}`}` (e.g. `Code snippet: typescript`, `Code snippet: python`).
3. **Screen Reader Landmark Traversal**: Assistive technology users can press landmark navigation shortcuts (e.g., `R` in NVDA/JAWS or VoiceOver landmark rotor) to jump directly between code examples.

## 3. Code Implementation
In `frontend/src/components/docs/CodeBlock.tsx`:
```tsx
export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = "typescript",
  filename,
  showLineNumbers = true,
  highlightLines = [],
  className = "",
}) => {
  return (
    <div
      role="region"
      aria-label={`Code snippet: ${language}`}
      className={`w-full rounded-2xl border border-gray-800 bg-[#0d0f17] shadow-xl overflow-hidden text-gray-200 font-mono text-xs ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#131622] border-b border-gray-800/80">
        <div className="flex items-center gap-2">
          {langKey === "bash" || langKey === "sh" ? (
            <Terminal className="w-4 h-4 text-purple-400" />
          ) : (
            <FileCode className="w-4 h-4 text-blue-400" />
          )}

          {filename && (
            <span className="text-xs font-semibold text-gray-300 font-mono">
              {filename}
            </span>
          )}

          <span
            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${badgeInfo.bg} ${badgeInfo.text}`}
          >
            {badgeInfo.label}
          </span>
        </div>

        {/* Copy to Clipboard Action */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold"
          aria-label="Copy to Clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Code Display Area */}
      <div className="p-4 overflow-x-auto bg-[#07090f]">
        ...
      </div>
    </div>
  );
};
```

## 4. Supported Languages and Badges
| Language Prop | Badge Display | ARIA Landmark Label | File Icon Type | Syntax Highlighter |
| --- | --- | --- | --- | --- |
| `typescript` / `ts` | `TS` | `Code snippet: typescript` | `FileCode` | `Prism.languages.typescript` |
| `javascript` / `js` | `JS` | `Code snippet: javascript` | `FileCode` | `Prism.languages.javascript` |
| `python` / `py` | `Python` | `Code snippet: python` | `FileCode` | `Prism.languages.python` |
| `bash` / `sh` | `Bash` | `Code snippet: bash` | `Terminal` | `Prism.languages.bash` |
| `json` | `JSON` | `Code snippet: json` | `FileCode` | `Prism.languages.json` |
| `yaml` / `yml` | `YAML` | `Code snippet: yaml` | `FileCode` | `Prism.languages.yaml` |
| `sql` | `SQL` | `Code snippet: sql` | `FileCode` | Fallback JS/SQL grammar |

## 5. Landmark Navigation Flow
1. **Screen Reader Users**: Using the `R` key (Region Landmark) or screen reader rotor instantly focuses the start of a code block.
2. **Skipping Complex Code**: Users can immediately press the next landmark hotkey to skip past 50+ lines of code directly to the subsequent markdown explanation section.
3. **Copy Action**: Focus can be routed to the embedded "Copy to Clipboard" action button with full keyboard accessibility.
4. **Syntax Highlighting Accessibility**: Code lines are rendered cleanly in table structures with optional line numbers that are excluded from text selection (`select-none`) to preserve copy accuracy.

## 6. Acceptance Criteria & Verification
- [x] Code block elements carry `role="region"` and descriptive landmark labels (`aria-label={`Code snippet: ${language}`}`).
- [x] Screen reader users can traverse between snippets using landmark rotor/hotkeys.
- [x] Copy-to-clipboard button and Prism syntax highlighting operate seamlessly without regression.
- [x] Unit test suite in `frontend/src/test/CodeBlockLandmarks.test.tsx` validates:
  - Region role presence.
  - Dynamic language labels.
  - Multi-block landmark skipping.
  - Highlighted lines and copy actions.
  - JSON, YAML, Bash, and Python formatting.
  - Empty string and optional line numbers handling.
  - Copy button accessible state persistence.
