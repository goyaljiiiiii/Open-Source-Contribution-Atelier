"""DRF views for the Mentorship app."""

from __future__ import annotations

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import generics, permissions, status, views
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import (
    MentorProfile,
    MentorshipFeedback,
    MentorshipGoal,
    MentorshipMatch,
    MentorshipMilestone,
    MentorshipRequest,
    MentorshipSession,
)
from .serializers import (
    FindMentorsSerializer,
    MentorAnalyticsSerializer,
    MentorProfileSerializer,
    MentorshipFeedbackSerializer,
    MentorshipGoalSerializer,
    MentorshipMatchSerializer,
    MentorshipMilestoneSerializer,
    MentorshipRequestSerializer,
    MentorshipSessionSerializer,
    MenteeAnalyticsSerializer,
    ProgramStatsSerializer,
    SessionCompleteSerializer,
)
from .services import (
    complete_session,
    create_mentorship_request,
    find_mentors,
    get_mentee_analytics,
    get_mentor_analytics,
    get_program_stats,
    get_session_recommendations,
    respond_to_request,
)


# ---------------------------------------------------------------------------
#  Mentor Profiles
# ---------------------------------------------------------------------------


class MentorProfileListCreateView(generics.ListCreateAPIView):
    """List available mentors or create/update your mentor profile."""

    serializer_class = MentorProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MentorProfile.objects.filter(
            is_active=True,
        ).select_related("user")


class MentorProfileDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update a mentor profile."""

    serializer_class = MentorProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, _ = MentorProfile.objects.get_or_create(
            user=self.request.user,
        )
        return profile


class MyMentorProfileView(views.APIView):
    """Get your own mentor profile (create if not exists)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, created = MentorProfile.objects.get_or_create(
            user=request.user,
        )
        return Response(
            MentorProfileSerializer(profile).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
#  Find Mentors
# ---------------------------------------------------------------------------


class FindMentorsView(views.APIView):
    """Find the best mentors for a given skill or general guidance."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = FindMentorsSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        results = find_mentors(
            user=request.user,
            skill_slug=serializer.validated_data.get("skill", ""),
            min_rating=serializer.validated_data.get("min_rating", 0),
            limit=serializer.validated_data.get("limit", 10),
        )

        return Response({
            "mentors": [
                {
                    "user_id": r["user"].id,
                    "username": r["user"].username,
                    "score": r["score"],
                    "expertise": r["expertise"],
                    "rating": r["rating"],
                    "sessions": r["sessions"],
                    "capacity": r["capacity"],
                    "is_full": r["is_full"],
                    "bio": r["mentor_profile"].bio,
                }
                for r in results
            ],
            "count": len(results),
        })


# ---------------------------------------------------------------------------
#  Requests
# ---------------------------------------------------------------------------


class MentorshipRequestListCreateView(generics.ListCreateAPIView):
    """List your requests (as mentee) or create a new request."""

    serializer_class = MentorshipRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MentorshipRequest.objects.filter(
            mentee=self.request.user,
        ).select_related("mentor", "mentee")

    def perform_create(self, serializer):
        result = create_mentorship_request(
            mentee=self.request.user,
            mentor_id=serializer.validated_data["mentor"],
            subject=serializer.validated_data["subject"],
            message=serializer.validated_data.get("message", ""),
            skill_wanted=serializer.validated_data.get("skill_wanted", ""),
            preferred_frequency=serializer.validated_data.get(
                "preferred_frequency", "weekly"
            ),
        )
        if "error" in result:
            from rest_framework.exceptions import ValidationError

            raise ValidationError(result["error"])
        return result


class IncomingRequestListView(generics.ListAPIView):
    """List requests received as a mentor."""

    serializer_class = MentorshipRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MentorshipRequest.objects.filter(
            mentor=self.request.user,
        ).select_related("mentor", "mentee")


class RespondToRequestView(views.APIView):
    """Accept or decline a mentorship request."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, request_id):
        accept = request.data.get("accept", False)
        msg = request.data.get("response_message", "")

        result = respond_to_request(
            mentor=request.user,
            request_id=request_id,
            accept=accept,
            response_message=msg,
        )

        if "error" in result:
            return Response(
                result, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(result)


# ---------------------------------------------------------------------------
#  Matches
# ---------------------------------------------------------------------------


class MentorshipMatchListView(generics.ListAPIView):
    """List your active mentorship matches."""

    serializer_class = MentorshipMatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MentorshipMatch.objects.filter(
            models_Q_mentor_or_mentee=self.request.user,
            status="active",
        ).select_related("mentor", "mentee")


class MatchDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update a mentorship match."""

    serializer_class = MentorshipMatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q

        return MentorshipMatch.objects.filter(
            Q(mentor=self.request.user) | Q(mentee=self.request.user),
        ).select_related("mentor", "mentee")


class MatchRecommendationsView(views.APIView):
    """Get session topic recommendations for a match."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, match_id):
        from django.db.models import Q

        try:
            match = MentorshipMatch.objects.get(
                id=match_id,
                Q(mentor=request.user) | Q(mentee=request.user),
            )
        except MentorshipMatch.DoesNotExist:
            return Response(
                {"error": "Match not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        recs = get_session_recommendations(match)
        return Response({"recommendations": recs})


# ---------------------------------------------------------------------------
#  Sessions
# ---------------------------------------------------------------------------


class SessionListCreateView(generics.ListCreateAPIView):
    """List or create mentorship sessions."""

    serializer_class = MentorshipSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q

        return MentorshipSession.objects.filter(
            Q(mentor=self.request.user) | Q(mentee=self.request.user),
        ).select_related("mentor", "mentee")

    def perform_create(self, serializer):
        serializer.save(
            mentor=self.request.user,
            mentee=serializer.validated_data.get("mentee"),
        )


class SessionDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update a session."""

    serializer_class = MentorshipSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q

        return MentorshipSession.objects.filter(
            Q(mentor=self.request.user) | Q(mentee=self.request.user),
        )


class SessionStartView(views.APIView):
    """Mark a session as in-progress."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = MentorshipSession.objects.get(
                id=session_id,
                mentor=request.user,
                status="scheduled",
            )
        except MentorshipSession.DoesNotExist:
            return Response(
                {"error": "Session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        session.start_session()
        return Response({"status": "in_progress"})


class SessionCompleteView(views.APIView):
    """Complete a session with ratings and feedback."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        serializer = SessionCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = complete_session(
            session_id=session_id,
            mentor=request.user,
            **serializer.validated_data,
        )

        if "error" in result:
            return Response(
                result, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(result)


# ---------------------------------------------------------------------------
#  Goals
# ---------------------------------------------------------------------------


class MatchGoalListCreateView(generics.ListCreateAPIView):
    """List or create goals for a mentorship match."""

    serializer_class = MentorshipGoalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MentorshipGoal.objects.filter(
            match_id=self.kwargs["match_id"],
        )

    def perform_create(self, serializer):
        serializer.save(
            match_id=self.kwargs["match_id"],
            created_by=self.request.user,
        )


# ---------------------------------------------------------------------------
#  Feedback
# ---------------------------------------------------------------------------


class FeedbackListCreateView(generics.ListCreateAPIView):
    """List or submit feedback for a match."""

    serializer_class = MentorshipFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MentorshipFeedback.objects.filter(
            match_id=self.kwargs["match_id"],
        )

    def perform_create(self, serializer):
        match = MentorshipMatch.objects.get(
            id=self.kwargs["match_id"],
        )
        if self.request.user == match.mentor:
            to_user = match.mentee
            ft = "mentor_on_mentee"
        else:
            to_user = match.mentor
            ft = "mentee_on_mentor"

        serializer.save(
            match=match,
            from_user=self.request.user,
            to_user=to_user,
            feedback_type=ft,
        )


# ---------------------------------------------------------------------------
#  Analytics
# ---------------------------------------------------------------------------


class MentorAnalyticsView(views.APIView):
    """Get analytics for your mentorship program."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        analytics = get_mentor_analytics(request.user)
        return Response(MentorAnalyticsSerializer(analytics).data)


class MenteeAnalyticsView(views.APIView):
    """Get analytics for your learning journey as a mentee."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        analytics = get_mentee_analytics(request.user)
        return Response(MenteeAnalyticsSerializer(analytics).data)


class ProgramStatsView(views.APIView):
    """Get platform-wide mentorship program statistics."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        stats = get_program_stats()
        return Response(ProgramStatsSerializer(stats).data)


# Fix the Q import issue in MentorshipMatchListView
from django.db.models import Q
MentorshipMatchListView.get_queryset = lambda self: (
    MentorshipMatch.objects.filter(
        Q(mentor=self.request.user) | Q(mentee=self.request.user),
        status="active",
    ).select_related("mentor", "mentee")
)
