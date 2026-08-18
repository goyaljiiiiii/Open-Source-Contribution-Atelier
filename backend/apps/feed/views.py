from django.db import connection
from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import FeedEvent, FeedPost
from .serializers import FeedEventSerializer, FeedPostSerializer


class FeedEventViewSet(viewsets.ModelViewSet):
    queryset = FeedEvent.objects.all()
    serializer_class = FeedEventSerializer
    permission_classes = [permissions.IsAuthenticated]


class FeedPostViewSet(viewsets.ModelViewSet):
    queryset = FeedPost.objects.all()
    serializer_class = FeedPostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def get_queryset(self):
        qs = FeedPost.objects.all().select_related("author")
        post_type = self.request.query_params.get("post_type")
        if post_type and post_type in ["question", "discussion", "share"]:
            qs = qs.filter(post_type=post_type)
        return qs

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        query_str = request.query_params.get("q", "").strip()
        post_type = request.query_params.get("post_type", "").strip()

        qs = self.get_queryset()

        if post_type and post_type in ["question", "discussion", "share"]:
            qs = qs.filter(post_type=post_type)

        if not query_str:
            serializer = self.get_serializer(qs[:50], many=True)
            return Response({"results": serializer.data, "count": qs.count()})

        if connection.vendor == "postgresql":
            from django.contrib.postgres.search import (
                SearchHeadline,
                SearchQuery,
                SearchVector,
            )

            vector = SearchVector("title", weight="A") + SearchVector(
                "body", weight="B"
            )
            query = SearchQuery(query_str)
            qs = (
                qs.annotate(
                    headline_title=SearchHeadline("title", query),
                    headline_body=SearchHeadline("body", query),
                )
                .filter(Q(title__icontains=query_str) | Q(body__icontains=query_str))
                .order_by("-created_at")
            )
        else:
            qs = qs.filter(
                Q(title__icontains=query_str) | Q(body__icontains=query_str)
            ).order_by("-created_at")

        serializer = self.get_serializer(qs[:50], many=True)
        results = serializer.data

        return Response({"results": results, "count": len(results), "query": query_str})
