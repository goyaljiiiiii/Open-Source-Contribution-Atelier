# Collaborative Notes Accessibility & ARIA Label Standards

## 1. Context and Problem
The real-time collaborative markdown editor on `CollabNotesPage.tsx` and `MultiplayerEditor.tsx` provides rich markdown editing tools for pair-programming and RFC documentation.

Prior to this update:
- Formatting toolbar action buttons (Bold, Italic, Heading 1, Heading 2, Code Block, Bullet List, Checkbox) rendered icon graphics (`<Bold />`, `<Italic />`, etc.) without descriptive `aria-label` attributes.
- Screen reader users (such as VoiceOver, NVDA, and JAWS) encountered "unlabeled button" announcements, creating mystery controls.
- Action buttons in the workspace header (Download, Zen mode, Copy link, Save note) lacked explicit `aria-label` attributes.
- View mode switcher buttons lacked programmatic landmark group descriptions.

## 2. Accessibility & ARIA Implementation
To satisfy **WCAG 2.1 Success Criterion 4.1.2 (Name, Role, Value)** and **1.1.1 (Non-text Content)**:
1. **Descriptive ARIA Labels**: Added unambiguous action descriptions to all icon-only buttons:
   - `aria-label="Format text as bold"`
   - `aria-label="Format text as italic"`
   - `aria-label="Format text as heading level 1"`
   - `aria-label="Format text as heading level 2"`
   - `aria-label="Format text as code block"`
   - `aria-label="Format text as bullet list"`
   - `aria-label="Format text as task checkbox"`
2. **Toolbar Landmark**: Grouped formatting controls in a container marked with `role="toolbar"` and `aria-label="Formatting controls"`.
3. **View Mode Toggle Group**: Marked view selector with `role="group"` and `aria-label="Editor View Mode"`, plus descriptive button labels:
   - `aria-label="Switch to editor only view"`
   - `aria-label="Switch to split editor and preview view"`
   - `aria-label="Switch to rendered preview only view"`
4. **Workspace Action Buttons**:
   - `aria-label="Copy Live Share Link"`
   - `aria-label="Save note to backend database"`
   - `aria-label="Download Markdown file"`
   - Dynamic `aria-label={zenMode ? "Exit Zen Mode" : "Fullscreen Zen Mode"}`
5. **Button Semantics**: Ensured all buttons render with explicit `type="button"`.

## 3. Reference Implementation
```tsx
<div className="flex items-center gap-1" role="toolbar" aria-label="Formatting controls">
  <button
    type="button"
    onClick={() => insertFormatting("**", "**")}
    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-gray-200 transition-colors"
    title="Bold (**text**)"
    aria-label="Format text as bold"
  >
    <Bold className="w-3.5 h-3.5" />
  </button>
  <button
    type="button"
    onClick={() => insertFormatting("*", "*")}
    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-gray-200 transition-colors"
    title="Italic (*text*)"
    aria-label="Format text as italic"
  >
    <Italic className="w-3.5 h-3.5" />
  </button>
</div>
```

## 4. Accessibility Verification Matrix
| Component | Interaction / Element | ARIA Attribute | Accessible Name |
| --- | --- | --- | --- |
| `MultiplayerEditor` | Bold button | `aria-label` | "Format text as bold" |
| `MultiplayerEditor` | Italic button | `aria-label` | "Format text as italic" |
| `MultiplayerEditor` | Heading 1 button | `aria-label` | "Format text as heading level 1" |
| `MultiplayerEditor` | Heading 2 button | `aria-label` | "Format text as heading level 2" |
| `MultiplayerEditor` | Code Block button | `aria-label` | "Format text as code block" |
| `MultiplayerEditor` | Bullet List button | `aria-label` | "Format text as bullet list" |
| `MultiplayerEditor` | Task Checkbox button | `aria-label` | "Format text as task checkbox" |
| `CollabNotesPage` | Share button | `aria-label` | "Copy Live Share Link" |
| `CollabNotesPage` | Save button | `aria-label` | "Save note to backend database" |
| `CollabNotesPage` | Download button | `aria-label` | "Download Markdown file" |
| `CollabNotesPage` | Zen Mode toggle | `aria-label` | "Fullscreen Zen Mode" / "Exit Zen Mode" |

## 5. Acceptance Criteria & Verification
- [x] Every formatting toolbar icon button has a descriptive `aria-label`.
- [x] Screen readers announce action button names accurately.
- [x] Hover tooltips and titles remain synchronized with accessibility labels.
- [x] Unit test suite `frontend/src/test/CollabNotesA11y.test.tsx` validates:
  - Presence of all formatting ARIA labels.
  - Toolbar role semantics.
  - Workspace action button accessibility.
  - Markdown formatting insertion logic.
  - Zen mode dynamic toggle accessibility.
  - Word count calculation and template selector handlers.
