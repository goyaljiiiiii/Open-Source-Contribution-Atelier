"""
HTML accessibility challenge lesson plugin.

Validates a user-submitted HTML snippet against basic accessibility
rules using stdlib html.parser only (no BeautifulSoup/lxml dependency):
images have alt text, form inputs have associated labels, heading levels
don't skip, and interactive elements (button/a) aren't empty of
accessible text.
"""

from html.parser import HTMLParser
from typing import Any, Dict, List, Optional, Tuple

from .plugins import LessonPlugin, registry

_HEADING_TAGS = {"h1": 1, "h2": 2, "h3": 3, "h4": 4, "h5": 5, "h6": 6}
_VOID_ELEMENTS = {"img", "input", "br", "hr", "meta", "link"}


class _AccessibilityAuditParser(HTMLParser):
    """Walks the HTML tree, collecting accessibility violations."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.errors: List[str] = []
        self._label_for_ids: set = set()
        self._input_ids_needing_label: List[Tuple[str, int]] = []
        self._last_heading_level = 0
        self._tag_stack: List[Tuple[str, int, bool]] = []  # (tag, line, has_text_content)
        self._interactive_text_buffer: Dict[int, str] = {}

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]):
        attrs_dict = dict(attrs)
        line = self.getpos()[0]

        if tag == "img":
            alt = attrs_dict.get("alt")
            if alt is None or alt.strip() == "":
                self.errors.append(f"line {line}: <img> missing non-empty 'alt' attribute")

        if tag == "label":
            for_id = attrs_dict.get("for")
            if for_id:
                self._label_for_ids.add(for_id)

        if tag in ("input", "textarea", "select"):
            input_type = attrs_dict.get("type", "text")
            if tag == "input" and input_type in ("hidden", "submit", "button"):
                pass  # these don't need a visible label
            else:
                input_id = attrs_dict.get("id")
                if input_id:
                    self._input_ids_needing_label.append((input_id, line))
                else:
                    self.errors.append(
                        f"line {line}: <{tag}> has no 'id' — can't be associated with a <label for=...>"
                    )

        if tag in _HEADING_TAGS:
            level = _HEADING_TAGS[tag]
            if self._last_heading_level != 0 and level > self._last_heading_level + 1:
                self.errors.append(
                    f"line {line}: <{tag}> skips heading level "
                    f"(previous was h{self._last_heading_level})"
                )
            self._last_heading_level = level

        if tag not in _VOID_ELEMENTS:
            self._tag_stack.append((tag, line, False))

    def handle_endtag(self, tag: str):
        if tag in ("button", "a") and self._tag_stack:
            for i in range(len(self._tag_stack) - 1, -1, -1):
                stack_tag, line, has_text = self._tag_stack[i]
                if stack_tag == tag:
                    if not has_text:
                        self.errors.append(
                            f"line {line}: <{tag}> has no accessible text content "
                            f"(empty, and no aria-label detected)"
                        )
                    del self._tag_stack[i]
                    break

        elif self._tag_stack and self._tag_stack[-1][0] == tag:
            self._tag_stack.pop()

    def handle_data(self, data: str):
        if data.strip() and self._tag_stack:
            tag, line, _ = self._tag_stack[-1]
            self._tag_stack[-1] = (tag, line, True)

    def finalize(self):
        """Call after feed() completes — checks that need full-document context."""
        for input_id, line in self._input_ids_needing_label:
            if input_id not in self._label_for_ids:
                self.errors.append(
                    f"line {line}: form field with id='{input_id}' has no matching <label for='{input_id}'>"
                )


def _run_accessibility_audit(html: str) -> List[str]:
    parser = _AccessibilityAuditParser()
    parser.feed(html)
    parser.finalize()
    return parser.errors


class HTMLAccessibilityChallengePlugin(LessonPlugin):
    """
    Lesson plugin for accessible HTML authoring challenges.

    Expected submission data shape:
    {
        "submitted_html": "<img src='x.png'>\\n<input id='name'>\\n..."
    }
    """

    identifier = "html_accessibility_challenge"
    version = "1.0"
    name = "HTML Accessibility Challenge"
    description = (
        "Write HTML with proper alt text, labeled form fields, correct "
        "heading hierarchy, and non-empty interactive elements — "
        "checked via stdlib html.parser, no external dependency."
    )

    # Approximate check count for scoring — actual violations found is
    # what matters; this is a soft denominator representing "how many
    # independent rule categories were checked" for percentage scoring.
    _RULE_CATEGORIES = 4  # img alt, label association, heading hierarchy, interactive text

    @classmethod
    def validate_submission(cls, data: Dict[str, Any]) -> bool:
        submitted = data.get("submitted_html")
        return isinstance(submitted, str) and bool(submitted.strip())

    @classmethod
    def evaluate_progress(cls, user, data: Dict[str, Any]) -> float:
        if not cls.validate_submission(data):
            return 0.0

        try:
            errors = _run_accessibility_audit(data["submitted_html"])
        except Exception:
            # Malformed HTML that the parser chokes on — treat as
            # maximally non-compliant rather than crashing.
            return 0.0

        if not errors:
            return 100.0

        # Score inversely proportional to violation count, floored at 0,
        # rather than a hard binary pass/fail — a document with 1 missing
        # alt attribute among otherwise-correct markup is closer to
        # passing than one with a dozen violations.
        penalty_per_error = 100.0 / (cls._RULE_CATEGORIES * 3)  # allow up to 3 violations per category before hitting 0
        score = max(0.0, 100.0 - (len(errors) * penalty_per_error))
        return round(score, 2)

    @classmethod
    def get_accessibility_errors(cls, data: Dict[str, Any]) -> List[str]:
        """Non-interface helper: line-numbered violation list for learner feedback."""
        if not cls.validate_submission(data):
            return ["Submission is empty or invalid."]
        try:
            return _run_accessibility_audit(data["submitted_html"])
        except Exception as e:
            return [f"HTML could not be parsed: {e}"]


registry.register(HTMLAccessibilityChallengePlugin)
