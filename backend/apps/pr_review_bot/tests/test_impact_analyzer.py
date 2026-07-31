import pytest

from apps.ml_triage.models.flaky_test_predictor import FlakyTestPredictor
from apps.pr_review_bot.services.impact_analyzer import PRImpactAnalyzer


class TestPRImpactAnalyzer:

    def setup_method(self):
        self.analyzer = PRImpactAnalyzer()
        self.predictor = FlakyTestPredictor()

    def test_parse_python_imports(self):
        code = """
import os
import sys
from django.db import models
from apps.webhooks.models import WebhookEndpoint
"""
        imports = self.analyzer.parse_python_imports(code)
        assert "os" in imports
        assert "sys" in imports
        assert "django" in imports
        assert "apps" in imports

    def test_parse_typescript_imports(self):
        code = """
import React, { useState } from 'react';
import { SkillGraphCanvas } from '../components/skills/SkillGraphCanvas';
import { api } from '../../api';
"""
        imports = self.analyzer.parse_typescript_imports(code)
        assert "react" in imports
        assert "SkillGraphCanvas" in imports

    def test_map_affected_tests(self):
        changed_files = [
            "backend/apps/webhooks/views.py",
            "frontend/src/pages/SkillTreePage.tsx",
        ]
        affected_tests = self.analyzer.map_affected_tests(changed_files)
        assert any("webhooks/tests" in t for t in affected_tests)
        assert any("SkillTreePage" in t for t in affected_tests)

    def test_predict_pr_risk(self):
        changed_files = [
            "backend/apps/webhooks/views.py",
            "backend/apps/webhooks/tasks.py",
        ]
        affected_tests = [
            "backend/apps/webhooks/tests.py",
            "integration/e2e_async_test.py",
        ]
        result = self.predictor.predict_pr_risk(
            changed_files=changed_files,
            added_lines=150,
            deleted_lines=30,
            affected_tests=affected_tests,
        )
        assert "risk_score" in result
        assert "risk_level" in result
        assert result["risk_score"] > 0
        assert isinstance(result["flaky_tests_detected"], list)

    def test_analyze_pr_impact(self):
        result = self.analyzer.analyze_pr_impact(
            pr_number=2321,
            repository="Open-Source-Contribution-Atelier",
            changed_files=["backend/apps/webhooks/views.py"],
            added_lines=50,
            deleted_lines=10,
        )
        assert result["pr_number"] == 2321
        assert "markdown_comment" in result
        assert "PR Risk Score" in result["markdown_comment"]
