from django.conf import settings
from django.db import models


class SandboxExecutionLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sandbox_execution_logs",
        help_text="The user who attempted the command.",
    )
    command = models.TextField(help_text="The command the user attempted to execute.")
    accepted = models.BooleanField(help_text="Whether the command was accepted.")
    feedback = models.TextField(blank=True, help_text="Feedback returned to the user.")
    score_delta = models.IntegerField(
        help_text="Score change resulting from this attempt."
    )
    created_at = models.DateTimeField(
        auto_now_add=True, help_text="When the attempt was made."
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        username = self.user.get_username() if self.user else "Anonymous"
        cmd_preview = (
            (self.command[:47] + "...") if len(self.command) > 50 else self.command
        )
        return (
            f"[{'Accepted' if self.accepted else 'Rejected'}] {username}: {cmd_preview}"
        )

class ExecutionViolationLog(models.Model):
    class ViolationType(models.TextChoices):
        MEMORY = "memory", "Memory Limit Exceeded"
        TIMEOUT = "timeout", "Execution Timeout"
        SECURITY = "security", "AST Security Violation"
        CONCURRENCY = "concurrency", "Concurrency Limit Exceeded"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="execution_violations"
    )
    user_identifier = models.CharField(max_length=255, help_text="Fallback for anonymous users (e.g., channel name)")
    code_snippet = models.TextField()
    violation_type = models.CharField(max_length=20, choices=ViolationType.choices)
    details = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.violation_type} by {self.user_identifier or self.user} at {self.timestamp}"
