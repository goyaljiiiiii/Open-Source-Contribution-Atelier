from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ..serializers.skill_tree_serializers import (
    CompleteNodeSerializer,
    SkillTreeOverviewSerializer,
)

# In-memory / DB-seeded Skill Tree Data Store representing the RPG skill node graph
SKILL_TREE_NODES = [
    # Open Source & Git Track (Core Foundation)
    {
        "id": "git-basics",
        "title": "Git Basics & CLI Setup",
        "domain": "open_source",
        "category": "Version Control",
        "description": "Master essential git commands: init, clone, add, commit, status, push, and pull.",
        "prerequisites": [],
        "status": "completed",
        "xp_reward": 100,
        "difficulty": "Beginner",
        "position": {"x": 100, "y": 300},
        "recommended_lessons": [
            {"id": "git-101", "title": "Introduction to Git Version Control", "duration": "15 min"},
            {"id": "git-102", "title": "Configuring SSH Keys and User Credentials", "duration": "10 min"}
        ],
        "related_challenges": [
            {"id": "c-git-01", "title": "First Commit Sandbox", "xp": 50}
        ],
        "badge_reward": {"name": "Git Initiate", "icon": "GitBranch", "color": "#4ECDC4"},
        "progress_percent": 100
    },
    {
        "id": "branching-strategies",
        "title": "Branching & Feature Workflows",
        "domain": "open_source",
        "category": "Version Control",
        "description": "Learn feature branching, Gitflow, trunk-based development, and HEAD pointers.",
        "prerequisites": ["git-basics"],
        "status": "unlocked",
        "xp_reward": 150,
        "difficulty": "Beginner",
        "position": {"x": 280, "y": 300},
        "recommended_lessons": [
            {"id": "git-201", "title": "Creating & Managing Feature Branches", "duration": "20 min"}
        ],
        "related_challenges": [
            {"id": "c-git-02", "title": "Branch Switching & Fast-Forward Merges", "xp": 75}
        ],
        "badge_reward": {"name": "Branch Master", "icon": "GitFork", "color": "#45B7D1"},
        "progress_percent": 60
    },
    {
        "id": "conflict-resolution",
        "title": "Merge Conflict Resolution",
        "domain": "open_source",
        "category": "Collaboration",
        "description": "Resolve complex merge conflicts, perform interactive rebase, and cherry-pick commits.",
        "prerequisites": ["branching-strategies"],
        "status": "unlocked",
        "xp_reward": 250,
        "difficulty": "Intermediate",
        "position": {"x": 480, "y": 300},
        "recommended_lessons": [
            {"id": "git-301", "title": "Handling Merge Conflicts step-by-step", "duration": "25 min"}
        ],
        "related_challenges": [
            {"id": "c-git-03", "title": "3-Way Merge Conflict Challenge", "xp": 150}
        ],
        "badge_reward": {"name": "Conflict Tamer", "icon": "GitPullRequest", "color": "#FF6B6B"},
        "progress_percent": 20
    },
    {
        "id": "ci-cd-pipelines",
        "title": "CI/CD & GitHub Actions",
        "domain": "devops",
        "category": "Automation",
        "description": "Automate testing, linting, and releases using GitHub Actions and Docker pipelines.",
        "prerequisites": ["conflict-resolution"],
        "status": "locked",
        "xp_reward": 350,
        "difficulty": "Advanced",
        "position": {"x": 680, "y": 300},
        "recommended_lessons": [
            {"id": "cicd-101", "title": "Writing GitHub Actions Workflows", "duration": "30 min"}
        ],
        "related_challenges": [
            {"id": "c-cicd-01", "title": "Automated Matrix Build Runner", "xp": 200}
        ],
        "badge_reward": {"name": "Automation Wizard", "icon": "Cpu", "color": "#A78BFA"},
        "progress_percent": 0
    },
    {
        "id": "open-source-maintainer",
        "title": "Open Source Maintainer Mastery",
        "domain": "open_source",
        "category": "Leadership",
        "description": "Triage issues, review pull requests, enforce CODEOWNERS, publish releases, and build communities.",
        "prerequisites": ["ci-cd-pipelines", "pr-review-mastery"],
        "status": "locked",
        "xp_reward": 500,
        "difficulty": "Expert",
        "position": {"x": 900, "y": 300},
        "recommended_lessons": [
            {"id": "os-401", "title": "Maintainer Playbook & Community Triage", "duration": "45 min"}
        ],
        "related_challenges": [
            {"id": "c-os-01", "title": "Project Release Governance", "xp": 300}
        ],
        "badge_reward": {"name": "Maintainer Vanguard", "icon": "Award", "color": "#F59E0B"},
        "progress_percent": 0
    },

    # Frontend Track
    {
        "id": "react-basics",
        "title": "React 19 & Component Design",
        "domain": "frontend",
        "category": "Frontend Frameworks",
        "description": "Build modern UI components using React 19 hooks, state, and props.",
        "prerequisites": ["git-basics"],
        "status": "completed",
        "xp_reward": 150,
        "difficulty": "Beginner",
        "position": {"x": 280, "y": 140},
        "recommended_lessons": [
            {"id": "react-101", "title": "React 19 Core Concepts", "duration": "20 min"}
        ],
        "related_challenges": [
            {"id": "c-react-01", "title": "Interactive Counter & State", "xp": 80}
        ],
        "badge_reward": {"name": "React Novice", "icon": "Code", "color": "#61DAFB"},
        "progress_percent": 100
    },
    {
        "id": "typescript-mastery",
        "title": "TypeScript & Type Safety",
        "domain": "frontend",
        "category": "Language",
        "description": "Master strict TypeScript types, interfaces, generics, and utility types.",
        "prerequisites": ["react-basics"],
        "status": "unlocked",
        "xp_reward": 200,
        "difficulty": "Intermediate",
        "position": {"x": 480, "y": 140},
        "recommended_lessons": [
            {"id": "ts-101", "title": "Generics & Advanced TS Patterns", "duration": "25 min"}
        ],
        "related_challenges": [
            {"id": "c-ts-01", "title": "Strongly Typed API Adapter", "xp": 120}
        ],
        "badge_reward": {"name": "Type Guardian", "icon": "ShieldCheck", "color": "#3178C6"},
        "progress_percent": 40
    },
    {
        "id": "state-management",
        "title": "Redux Toolkit & React Query",
        "domain": "frontend",
        "category": "Architecture",
        "description": "Handle complex asynchronous server state and global app store cleanly.",
        "prerequisites": ["typescript-mastery"],
        "status": "locked",
        "xp_reward": 280,
        "difficulty": "Intermediate",
        "position": {"x": 680, "y": 140},
        "recommended_lessons": [
            {"id": "state-101", "title": "TanStack Query & Redux RTK Query", "duration": "30 min"}
        ],
        "related_challenges": [
            {"id": "c-state-01", "title": "Optimistic Cache Updates", "xp": 160}
        ],
        "badge_reward": {"name": "State Architect", "icon": "Layers", "color": "#764ABC"},
        "progress_percent": 0
    },

    # Backend Track
    {
        "id": "django-rest",
        "title": "Django 5 & DRF APIs",
        "domain": "backend",
        "category": "Backend Frameworks",
        "description": "Design secure REST APIs with Django REST Framework, ORM, and JWT authentication.",
        "prerequisites": ["git-basics"],
        "status": "completed",
        "xp_reward": 180,
        "difficulty": "Beginner",
        "position": {"x": 280, "y": 460},
        "recommended_lessons": [
            {"id": "django-101", "title": "Django ORM & DRF ViewSets", "duration": "25 min"}
        ],
        "related_challenges": [
            {"id": "c-django-01", "title": "CRUD API Serializer Challenge", "xp": 100}
        ],
        "badge_reward": {"name": "Python Craftsman", "icon": "Server", "color": "#092E20"},
        "progress_percent": 100
    },
    {
        "id": "async-workers",
        "title": "Celery & Redis Workers",
        "domain": "backend",
        "category": "Distributed Systems",
        "description": "Offload long-running tasks, email queues, and background jobs asynchronously.",
        "prerequisites": ["django-rest"],
        "status": "unlocked",
        "xp_reward": 260,
        "difficulty": "Intermediate",
        "position": {"x": 480, "y": 460},
        "recommended_lessons": [
            {"id": "celery-101", "title": "Task Queue Architecture with Redis", "duration": "25 min"}
        ],
        "related_challenges": [
            {"id": "c-celery-01", "title": "Background Mailer & Retry Policy", "xp": 140}
        ],
        "badge_reward": {"name": "Queue Master", "icon": "Zap", "color": "#DC2626"},
        "progress_percent": 50
    },
    {
        "id": "pr-review-mastery",
        "title": "Code Review & Quality CI",
        "domain": "open_source",
        "category": "Code Quality",
        "description": "Conduct thorough code reviews, enforce unit tests, linting, and security static analysis.",
        "prerequisites": ["conflict-resolution"],
        "status": "unlocked",
        "xp_reward": 300,
        "difficulty": "Advanced",
        "position": {"x": 680, "y": 460},
        "recommended_lessons": [
            {"id": "review-101", "title": "Constructive Peer Review Etiquette", "duration": "20 min"}
        ],
        "related_challenges": [
            {"id": "c-review-01", "title": "Find the Security Vulnerability PR", "xp": 180}
        ],
        "badge_reward": {"name": "Sentinel Inspector", "icon": "CheckCircle2", "color": "#10B981"},
        "progress_percent": 30
    }
]

SKILL_TREE_EDGES = [
    {"id": "e1", "source": "git-basics", "target": "branching-strategies", "status": "completed"},
    {"id": "e2", "source": "branching-strategies", "target": "conflict-resolution", "status": "active"},
    {"id": "e3", "source": "conflict-resolution", "target": "ci-cd-pipelines", "status": "locked"},
    {"id": "e4", "source": "ci-cd-pipelines", "target": "open-source-maintainer", "status": "locked"},
    {"id": "e5", "source": "git-basics", "target": "react-basics", "status": "completed"},
    {"id": "e6", "source": "react-basics", "target": "typescript-mastery", "status": "active"},
    {"id": "e7", "source": "typescript-mastery", "target": "state-management", "status": "locked"},
    {"id": "e8", "source": "git-basics", "target": "django-rest", "status": "completed"},
    {"id": "e9", "source": "django-rest", "target": "async-workers", "status": "active"},
    {"id": "e10", "source": "conflict-resolution", "target": "pr-review-mastery", "status": "active"},
    {"id": "e11", "source": "pr-review-mastery", "target": "open-source-maintainer", "status": "locked"},
]

TRACKS = [
    {"id": "all", "name": "All Mastery Paths", "count": len(SKILL_TREE_NODES)},
    {"id": "open_source", "name": "Open Source Workflow", "count": 5},
    {"id": "frontend", "name": "Frontend Track (React / TS)", "count": 3},
    {"id": "backend", "name": "Backend Track (Django / Python)", "count": 2},
    {"id": "devops", "name": "DevOps & CI/CD", "count": 1},
]


class SkillTreeViewSet(viewsets.ViewSet):
    """
    API ViewSet for Interactive Contributor Skill Tree & Dynamic Mastery Graph UI (#2323).
    """
    permission_classes = [AllowAny]

    def list(self, request):
        """
        Get full skill tree structure with node progression, parent prerequisites, and user XP stats.
        """
        user_xp = 1250
        mastered_nodes = [node for node in SKILL_TREE_NODES if node["status"] == "completed"]
        unlocked_nodes = [node for node in SKILL_TREE_NODES if node["status"] == "unlocked"]

        data = {
            "user_xp": user_xp,
            "mastered_count": len(mastered_nodes),
            "total_nodes": len(SKILL_TREE_NODES),
            "unlocked_count": len(unlocked_nodes),
            "current_track": "all",
            "tracks": TRACKS,
            "nodes": SKILL_TREE_NODES,
            "edges": SKILL_TREE_EDGES,
        }

        serializer = SkillTreeOverviewSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="complete-node")
    def complete_node(self, request):
        """
        Attempt to complete a skill node after checking prerequisite mastery.
        """
        serializer = CompleteNodeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        node_id = serializer.validated_data["node_id"]
        target_node = next((n for n in SKILL_TREE_NODES if n["id"] == node_id), None)

        if not target_node:
            return Response({"error": f"Node with ID '{node_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        # Validate prerequisites
        unfulfilled_prereqs = []
        for prereq_id in target_node["prerequisites"]:
            parent = next((n for n in SKILL_TREE_NODES if n["id"] == prereq_id), None)
            if not parent or parent["status"] != "completed":
                unfulfilled_prereqs.append(prereq_id)

        if unfulfilled_prereqs:
            return Response(
                {
                    "error": "Prerequisites unfulfilled.",
                    "missing_prerequisites": unfulfilled_prereqs
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mark node completed & update children
        target_node["status"] = "completed"
        target_node["progress_percent"] = 100

        # Unlock children whose prerequisites are now fulfilled
        unlocked_children = []
        for node in SKILL_TREE_NODES:
            if node["status"] == "locked":
                # Check if all prereqs completed now
                all_done = all(
                    next((p["status"] == "completed" for p in SKILL_TREE_NODES if p["id"] == req), False)
                    for req in node["prerequisites"]
                )
                if all_done:
                    node["status"] = "unlocked"
                    unlocked_children.append(node["id"])

        return Response(
            {
                "message": f"Congratulations! You have mastered skill: {target_node['title']}",
                "node_id": node_id,
                "xp_gained": target_node["xp_reward"],
                "badge_awarded": target_node.get("badge_reward"),
                "newly_unlocked": unlocked_children
            },
            status=status.HTTP_200_OK
        )
