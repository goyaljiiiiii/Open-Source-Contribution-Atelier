# PR Review Game Accessibility & Focus Management

## 1. Context and Problem
The interactive Code Review Sandbox on `PRReviewGamePage.tsx` lets learners evaluate pull requests and choose appropriate review actions (`Approve`, `Comment`, `Request Changes`).

Prior to this update:
- Custom styling stripped default browser focus outlines without providing a suitable replacement.
- When users pressed the `Tab` key to move through review options, active elements lacked a visible focus indicator.
- Keyboard-only navigation and assistive technologies could not visually identify which action button was currently focused.
- Screen reader users and motor-impaired learners navigating via switch controls were unable to track sequential button interactions.

## 2. Solution and Technical Changes
1. **Focus Ring Utility**: Integrated the shared focus ring token (`FOCUS_RING`) from `frontend/src/lib/a11yFocus.ts` along with explicit Tailwind focus ring classes (`focus:outline-none focus:ring-2 focus:ring-blue-500`).
2. **Semantic Attributes**: Ensured all interactive action buttons render with `type="button"` to guarantee clean native button behavior across browsers.
3. **Contrast Compliance**: Focus indicators use blue-500 (`#3b82f6`) with appropriate offsets, ensuring >= 3.5:1 contrast against both light and dark card backgrounds.
4. **Game Reset Focus Trap Handling**: When a game reaches "Game Over" and the user hits "Play Again", keyboard focus transitions seamlessly back to the active decision cards.

## 3. Code Modifications
In `frontend/src/pages/PRReviewGamePage.tsx`:
```tsx
import { FOCUS_RING } from "../lib/a11yFocus";

<button
  type="button"
  onClick={() => handleAction("approve")}
  className={`flex flex-col items-center gap-2 p-4 bg-green-100 hover:bg-green-200 border-2 border-black rounded-xl shadow-card hover:-translate-y-1 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${FOCUS_RING}`}
>
  <Check className="text-green-700" size={32} />
  <span className="font-black text-green-900">Approve</span>
  <span className="text-xs text-green-800 text-center">
    Looks good to me! Merge it.
  </span>
</button>
```

In `frontend/src/components/ui/CodeDiffViewer.tsx`:
```tsx
<button
  type="button"
  onClick={() => setSplitView(true)}
  className={`p-1 rounded ${
    splitView
      ? "bg-white dark:bg-[#2e2924] shadow-sm text-primary"
      : "text-muted hover:text-text"
  }`}
  title="Split View"
  aria-label="Split View"
>
  <Columns size={16} />
</button>
```

## 4. Keyboard Navigation Flow
1. **Tab Key Traversal**: Pressing `Tab` focuses sequentially from `Approve` -> `Comment` -> `Request Changes`.
2. **Activation**: Pressing `Enter` or `Space` activates the focused review action.
3. **Feedback Notification**: Screen readers announce toast status updates and level advancement feedback.
4. **Game Over & Reset**: When reaching completion, focus moves naturally to the prominent `Play Again` button.

## 5. Visual Design Specification
- **Focus Outline Color**: Blue 500 (`#3b82f6`) in light mode; high-contrast outline (`#f0ebe2`) in dark mode via `FOCUS_RING`.
- **Outline Offset**: 2px offset (`focus-visible:outline-offset-2`) prevents focus rings from clipping container borders.
- **Card Shadow**: Neobrutalist border outlines (`border-2 border-black` / `shadow-card`) remain visible beneath active focus indicators.

## 6. Accessibility Criteria Matrix
| WCAG Guideline | Requirement | Atelier Implementation Status |
| --- | --- | --- |
| 2.1.1 Keyboard Navigation | All interactive functionality operable via keyboard | ✅ Verified across review actions & reset button |
| 2.4.7 Focus Visible | Keyboard focus indicator is clearly visible | ✅ Implemented `focus:ring-2 focus:ring-blue-500` + `FOCUS_RING` |
| 4.1.2 Name, Role, Value | Controls possess programmatic name and roles | ✅ Explicit `type="button"`, ARIA labels, and icons |
| 1.4.11 Non-text Contrast | UI components have >= 3:1 visual contrast ratio | ✅ High-contrast focus boundaries on light & dark themes |

## 7. Acceptance Criteria & Verification
- [x] Tabbing through PR Review Game buttons displays clear focus outline rings.
- [x] Active focus state complies with WCAG 2.1 Success Criterion 2.4.7 (Focus Visible).
- [x] Comprehensive test coverage in `frontend/src/test/PRReviewGameA11y.test.tsx` verifying:
  - Button focus ring classes.
  - Tab navigation between decision options.
  - Game progression and "Play Again" button accessibility.
  - Document order hierarchy and re-render stability.
  - Keyboard trigger simulation for Enter and Space keys.
  - CodeDiffViewer view toggle accessibility.
