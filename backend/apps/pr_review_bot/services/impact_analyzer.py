import ast
import re
from typing import Any, Dict, List, Set

from apps.ml_triage.models.flaky_test_predictor import FlakyTestPredictor


class PRImpactAnalyzer:
    """
    Automated PR Code Impact & Flaky Test Risk Prediction Engine.
    Parses Python/TypeScript AST diffs, builds module dependency mapping,
    and runs ML flaky test prediction models.
    """

    def __init__(self):
        self.predictor = FlakyTestPredictor()

    def parse_python_imports(self, code_content: str) -> Set[str]:
        """
        Extracts imported module names from Python source code using AST.
        """
        imports = set()
        if not code_content or not code_content.strip():
            return imports

        try:
            tree = ast.parse(code_content)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.add(alias.name.split(".")[0])
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imports.add(node.module.split(".")[0])
        except Exception:
            # Regex fallback if code snippet contains syntax errors
            found = re.findall(
                r"^(?:import|from)\s+([a-zA-Z0-9_]+)", code_content, re.MULTILINE
            )
            imports.update(found)

        return imports

    def parse_typescript_imports(self, code_content: str) -> Set[str]:
        """
        Extracts imported paths and modules from TypeScript/JavaScript source code using regex patterns.
        """
        imports = set()
        if not code_content:
            return imports

        matches = re.findall(r"import\s+.*?\s+from\s+['\"]([^'\"]+)['\"]", code_content)
        matches_direct = re.findall(r"import\s+['\"]([^'\"]+)['\"]", code_content)

        for imp in matches + matches_direct:
            clean_imp = imp.split("/")[-1].replace(".tsx", "").replace(".ts", "")
            imports.add(clean_imp)

        return imports

    def map_affected_tests(self, changed_files: List[str]) -> List[str]:
        """
        Maps a list of changed source files to their corresponding test suites via dependency tree rules.
        """
        affected_tests = set()

        for filepath in changed_files:
            norm_path = filepath.replace("\\", "/")

            if "test" in norm_path.lower() or "spec" in norm_path.lower():
                affected_tests.add(norm_path)
                continue

            if norm_path.startswith("backend/apps/"):
                parts = norm_path.split("/")
                if len(parts) >= 3:
                    app_name = parts[2]
                    affected_tests.add(f"backend/apps/{app_name}/tests.py")
                    affected_tests.add(
                        f"backend/apps/{app_name}/tests_{parts[-1].replace('.py', '')}.py"
                    )

            elif norm_path.startswith("frontend/src/"):
                base_name = norm_path.split("/")[-1].split(".")[0]
                affected_tests.add(f"frontend/src/__tests__/{base_name}.test.tsx")
                affected_tests.add(f"frontend/src/pages/__tests__/{base_name}.test.tsx")

            else:
                base_name = norm_path.split("/")[-1].split(".")[0]
                affected_tests.add(f"tests/test_{base_name}.py")

        return sorted(list(affected_tests))

    def analyze_pr_impact(
        self,
        pr_number: int,
        repository: str,
        changed_files: List[str],
        added_lines: int = 0,
        deleted_lines: int = 0,
        raw_diff: str = "",
    ) -> Dict[str, Any]:
        """
        Executes full impact analysis & flaky test prediction pipeline for a PR.
        """
        affected_tests = self.map_affected_tests(changed_files)

        prediction = self.predictor.predict_pr_risk(
            changed_files=changed_files,
            added_lines=added_lines,
            deleted_lines=deleted_lines,
            affected_tests=affected_tests,
        )

        markdown_comment = self.format_markdown_comment(
            pr_number=pr_number,
            risk_score=prediction["risk_score"],
            risk_level=prediction["risk_level"],
            changed_files=changed_files,
            affected_tests=affected_tests,
            flaky_tests=prediction["flaky_tests_detected"],
        )

        return {
            "pr_number": pr_number,
            "repository": repository,
            "risk_score": prediction["risk_score"],
            "risk_level": prediction["risk_level"],
            "changed_files_count": len(changed_files),
            "affected_tests": affected_tests,
            "flaky_tests": prediction["flaky_tests_detected"],
            "risk_breakdown": prediction["breakdown"],
            "markdown_comment": markdown_comment,
        }

    def format_markdown_comment(
        self,
        pr_number: int,
        risk_score: float,
        risk_level: str,
        changed_files: List[str],
        affected_tests: List[str],
        flaky_tests: List[Dict[str, Any]],
    ) -> str:
        """
        Formats a clean, GitHub-flavored Markdown comment summary.
        """
        risk_badges = {
            "CRITICAL": "🔴 CRITICAL",
            "HIGH": "🟧 HIGH",
            "MEDIUM": "🟨 MEDIUM",
            "LOW": "🟩 LOW",
        }
        risk_badge = risk_badges.get(risk_level, "🟩 LOW")

        lines = [
            f"### 🤖 Automated PR Impact & Flaky Test Risk Report for PR #{pr_number}",
            "",
            f"**PR Risk Score**: `{risk_score}%` — **Risk Level**: {risk_badge}",
            "",
            "#### 📊 Impact Analysis Summary",
            "| Metric | Result |",
            "| --- | --- |",
            f"| **Changed Files** | `{len(changed_files)} files` |",
            f"| **Impacted Test Suites** | `{len(affected_tests)} test files` |",
            f"| **Flaky Test Risk Count** | `{len(flaky_tests)} potential risks` |",
            "",
            "#### 🧪 Suggested Unit Test Suites to Run",
        ]

        if affected_tests:
            for test in affected_tests[:5]:
                lines.append(f"- [x] `{test}`")
        else:
            lines.append("- [ ] No specific test suite mappings detected.")

        if flaky_tests:
            lines.extend(
                [
                    "",
                    "⚠️ **Detected Potential Flaky Test Risks**:",
                ]
            )
            for ft in flaky_tests:
                lines.append(
                    f"- **`{ft['test_name']}`** — {ft['flaky_probability']}% failure probability ({ft['reason']})"
                )

        lines.extend(
            [
                "",
                "---",
                "*Automated analysis generated by Open Source Contribution Atelier ML Bot.*",
            ]
        )

        return "\n".join(lines)
