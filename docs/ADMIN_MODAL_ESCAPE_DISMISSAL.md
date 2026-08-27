# Admin Modal Escape Key Dismissal Guidelines & Standards

## 1. Context and Problem
Administrative portals (`AuditLogViewerPage.tsx`, `CeleryDashboardPage.tsx`, `OAuthClients.tsx`) feature popover dialog modals and slide-overs for inspecting audit diffs, Celery task run payloads, and OAuth registration flows.
Previously, these modals only closed when the user clicked the specific "X" or "Close" button. Users navigating via keyboard could not press the standard `Escape` (`Esc`) key to quickly dismiss the modal overlay, violating keyboard navigation conventions and WCAG 2.1 modal dialog recommendations.

## 2. Solution & Accessibility Standards
To satisfy **WCAG 2.1 Success Criterion 2.1.1 (Keyboard)** and **2.1.2 (No Keyboard Trap)**:
1. **Global Escape Key Listeners**: Each modal-hosting admin page adds a targeted `keydown` event listener checking `e.key === "Escape"`.
2. **Conditional Activation & Cleanup**: Event listeners are registered dynamically when the modal is active and removed on dismissal or component unmount to prevent memory leaks or unintended key interception.
3. **Admin Pages Standardized**:
   - `AuditLogViewerPage.tsx`: Inspect audit event record details modal.
   - `CeleryDashboardPage.tsx`: Inspect task run details and tracebacks modal.
   - `OAuthClients.tsx`: Register OAuth Application modal and PKCE Auth URL tester modal.

## 3. Implementation Pattern
```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && selectedEvent) {
      setSelectedEvent(null);
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [selectedEvent]);
```

## 4. Modal Dialog Accessibility Matrix
| Admin Page | Modal Dialog Purpose | State Variable | Dismissal Trigger | Escape Key Handled |
| --- | --- | --- | --- | --- |
| `AuditLogViewerPage` | Audit event diff details | `selectedEvent` | `setSelectedEvent(null)` | Yes (`Escape`) |
| `CeleryDashboardPage` | Task run detail & payload | `selectedTaskRun` | `setSelectedTaskRun(null)` | Yes (`Escape`) |
| `OAuthClients` | Register OAuth Client modal | `showCreateModal` | `setShowCreateModal(false)` | Yes (`Escape`) |
| `OAuthClients` | PKCE Auth URL Tester | `showTestModal` | `setShowTestModal(null)` | Yes (`Escape`) |

## 5. Event Lifecycle and Keyboard Handling
1. **Mounting Phase**: Component initializes state without attaching global key listeners until a modal opens (or checks if active state is non-null).
2. **Open Phase**: User selects a task, client, or audit record. The modal dialog renders atop an overlay backdrop (`backdrop-blur-sm bg-black/60`).
3. **Escape Interception**: User presses `Escape`. The attached listener captures the keydown event and resets the modal state to `null` or `false`.
4. **Cleanup Phase**: When modal is unmounted, `window.removeEventListener("keydown", handleKeyDown)` fires cleanly.

## 6. Verification Checklist
- [x] Pressing `Escape` while an audit diff modal is open immediately closes the overlay.
- [x] Pressing `Escape` while Celery task details modal is open immediately closes the overlay.
- [x] Pressing `Escape` in OAuth registration and test flow modals closes them cleanly.
- [x] Unit test suite in `frontend/src/test/AdminModalEscapeDismissal.test.tsx` validates:
  - AuditLogViewerPage Escape keydown dismissal.
  - CeleryDashboardPage task details Escape dismissal.
  - OAuth client creation modal Escape dismissal.
  - OAuth test URL modal Escape dismissal.
  - Proper listener cleanup on unmount.
  - Repeated open and dismiss sequences.
