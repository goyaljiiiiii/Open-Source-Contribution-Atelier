import copy
import hashlib
from typing import Any, Dict, List


class GitRebaseEngine:
    """
    Simulates interactive Git rebase (git rebase -i), commit squashing,
    message rewording, dropping commits, and conflict resolution scenarios.
    """

    def __init__(self):
        pass

    def execute_interactive_rebase(
        self,
        base_commit: str,
        commit_actions: List[Dict[str, Any]],
        scenario_id: str = "default",
    ) -> Dict[str, Any]:
        """
        Executes a sequence of interactive rebase commands (pick, reword, squash, fixup, drop).
        Returns the resulting rebased commit history DAG and conflict status if any.
        """
        rebased_commits = []
        conflicts = []
        squashed_buffer = None
        logs = [f"Executing: git rebase -i {base_commit}"]

        for idx, action_item in enumerate(commit_actions):
            action = action_item.get("action", "pick").lower()
            commit = copy.deepcopy(action_item.get("commit", {}))
            commit_id = commit.get("hash", f"c{idx+1}")
            message = action_item.get("new_message") or commit.get(
                "message", "Commit message"
            )

            if action == "drop":
                logs.append(f"DROP {commit_id[:7]} - {commit.get('message')}")
                continue

            elif action == "reword":
                commit["message"] = message
                commit["hash"] = self._generate_hash(message + commit_id)
                logs.append(f"REWORD {commit_id[:7]} -> New message: '{message}'")
                rebased_commits.append(commit)

            elif action == "pick":
                commit["hash"] = self._generate_hash(
                    commit.get("message", "") + str(idx)
                )
                logs.append(f"PICK {commit_id[:7]} - {commit.get('message')}")
                rebased_commits.append(commit)

            elif action in ["squash", "fixup"]:
                if not rebased_commits:
                    # Cannot squash the very first commit in sequence
                    logs.append(
                        f"ERROR: Cannot '{action}' first commit {commit_id[:7]}. Defaulting to pick."
                    )
                    rebased_commits.append(commit)
                    continue

                prev_commit = rebased_commits[-1]
                if action == "squash":
                    prev_commit["message"] = f"{prev_commit['message']}\n\n* {message}"
                    logs.append(
                        f"SQUASH {commit_id[:7]} into {prev_commit['hash'][:7]}"
                    )
                else:  # fixup
                    logs.append(
                        f"FIXUP {commit_id[:7]} into {prev_commit['hash'][:7]} (discarding message)"
                    )

                prev_commit["hash"] = self._generate_hash(prev_commit["message"])
                prev_commit["files_changed"] = list(
                    set(
                        prev_commit.get("files_changed", [])
                        + commit.get("files_changed", [])
                    )
                )

            elif action == "edit":
                commit["status"] = "editing"
                logs.append(f"EDIT {commit_id[:7]} - Paused for amendments.")
                rebased_commits.append(commit)

            # Simulated Conflict Detection Rule:
            # If two reordered commits modify the same file (e.g. 'settings.py'), generate a conflict pause
            if idx > 0 and "conflict" in commit.get("message", "").lower():
                conflicts.append(
                    {
                        "commit_hash": commit["hash"],
                        "file": (
                            commit.get("files_changed", ["config.py"])[0]
                            if commit.get("files_changed")
                            else "config.py"
                        ),
                        "conflict_hunk": f"<<<<<<< HEAD\n{prev_commit['message']}\n=======\n{message}\n>>>>>>> {commit['hash'][:7]}",
                    }
                )

        success = len(conflicts) == 0

        return {
            "success": success,
            "scenario_id": scenario_id,
            "rebased_commits": rebased_commits,
            "conflicts": conflicts,
            "execution_logs": logs,
            "total_commits_count": len(rebased_commits),
        }

    def validate_scenario_completion(
        self, scenario_id: str, rebased_commits: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validates if the user achieved the clean commit history requirements for a given scenario.
        """
        if scenario_id == "squash-5-to-1":
            is_valid = len(rebased_commits) == 1
            reward_xp = 150 if is_valid else 0
            msg = (
                "Great job! You squashed 5 WIP draft commits into 1 clean atomic commit."
                if is_valid
                else "Keep squashing! Goal is 1 single commit."
            )

        elif scenario_id == "reword-and-clean":
            is_valid = len(rebased_commits) <= 2 and all(
                not c.get("message", "").startswith("wip") for c in rebased_commits
            )
            reward_xp = 200 if is_valid else 0
            msg = (
                "Clean commit history verified! No WIP commit messages remain."
                if is_valid
                else "Some WIP commits still remain."
            )

        else:
            is_valid = len(rebased_commits) > 0
            reward_xp = 100
            msg = "Rebase operation executed successfully."

        return {"completed": is_valid, "reward_xp": reward_xp, "message": msg}

    def _generate_hash(self, text: str) -> str:
        return hashlib.sha1(text.encode("utf-8")).hexdigest()[:7]
