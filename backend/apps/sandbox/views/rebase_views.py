from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.sandbox.services.rebase_engine import GitRebaseEngine

SCENARIOS = [
    {
        "id": "squash-5-to-1",
        "title": "Squash 5 WIP Draft Commits before PR Merge",
        "difficulty": "Beginner",
        "xp_reward": 150,
        "description": "You created 5 small 'wip' commits while building a feature. Use interactive rebase to squash them into 1 clean commit.",
        "base_branch": "main",
        "initial_commits": [
            {
                "hash": "a1b2c3d",
                "message": "feat: add user authentication form",
                "author": "contributor",
                "files_changed": ["src/auth.ts"],
            },
            {
                "hash": "e4f5g6h",
                "message": "wip fix typo in auth",
                "author": "contributor",
                "files_changed": ["src/auth.ts"],
            },
            {
                "hash": "i7j8k9l",
                "message": "wip add validation regex",
                "author": "contributor",
                "files_changed": ["src/auth.ts"],
            },
            {
                "hash": "m0n1o2p",
                "message": "wip update styles",
                "author": "contributor",
                "files_changed": ["src/styles.css"],
            },
            {
                "hash": "q3r4s5t",
                "message": "wip cleanup console.log",
                "author": "contributor",
                "files_changed": ["src/auth.ts"],
            },
        ],
    },
    {
        "id": "reword-and-clean",
        "title": "Reword Bad Messages & Drop Debug Code",
        "difficulty": "Intermediate",
        "xp_reward": 200,
        "description": "Fix non-descriptive commit messages with 'reword' and remove temporary debug logging commits with 'drop'.",
        "base_branch": "main",
        "initial_commits": [
            {
                "hash": "b8c9d0e",
                "message": "add stuff",
                "author": "contributor",
                "files_changed": ["src/api.ts"],
            },
            {
                "hash": "f1g2h3i",
                "message": "TEMP: debug print statements",
                "author": "contributor",
                "files_changed": ["src/api.ts"],
            },
            {
                "hash": "j4k5l6m",
                "message": "feat: connect websocket client",
                "author": "contributor",
                "files_changed": ["src/ws.ts"],
            },
        ],
    },
    {
        "id": "resolve-rebase-conflict",
        "title": "Interactive Rebase & Conflict Resolution",
        "difficulty": "Advanced",
        "xp_reward": 300,
        "description": "Rebase your feature branch onto updated main where conflicting changes exist in settings.py.",
        "base_branch": "main",
        "initial_commits": [
            {
                "hash": "c1d2e3f",
                "message": "feat: custom settings configuration",
                "author": "contributor",
                "files_changed": ["config/settings.py"],
            },
            {
                "hash": "g4h5i6j",
                "message": "conflict: update database lock timeout",
                "author": "contributor",
                "files_changed": ["config/settings.py"],
            },
        ],
    },
]


class GitRebaseSimulatorViewSet(viewsets.ViewSet):
    """
    API ViewSet for Interactive Git Rebase & Commit Squashing Scenario Simulator (#2319).
    """

    permission_classes = [AllowAny]

    def list(self, request):
        """
        List all available Git rebase challenge scenarios.
        """
        return Response({"scenarios": SCENARIOS}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="execute")
    def execute_rebase(self, request):
        """
        Execute interactive rebase actions on commit DAG.
        """
        base_commit = request.data.get("base_commit", "main")
        commit_actions = request.data.get("commit_actions", [])
        scenario_id = request.data.get("scenario_id", "default")

        engine = GitRebaseEngine()
        result = engine.execute_interactive_rebase(
            base_commit=base_commit,
            commit_actions=commit_actions,
            scenario_id=scenario_id,
        )

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="verify")
    def verify_rebase(self, request):
        """
        Verify if user successfully completed the scenario requirements.
        """
        scenario_id = request.data.get("scenario_id", "default")
        rebased_commits = request.data.get("rebased_commits", [])

        engine = GitRebaseEngine()
        verification = engine.validate_scenario_completion(
            scenario_id=scenario_id, rebased_commits=rebased_commits
        )

        return Response(verification, status=status.HTTP_200_OK)
