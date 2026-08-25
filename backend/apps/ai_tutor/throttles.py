from rest_framework.throttling import UserRateThrottle


class AiTutorRateThrottle(UserRateThrottle):
    """Limit AI Tutor queries to protect the upstream AI token budget."""

    scope = "ai_tutor"
