import json

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import WebhookDelivery, WebhookEndpoint
from .serializers import WebhookDeliverySerializer, WebhookEndpointSerializer
from .tasks import deliver_webhook


class WebhookEndpointViewSet(viewsets.ModelViewSet):
    serializer_class = WebhookEndpointSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WebhookEndpoint.objects.filter(user=self.request.user).order_by(
            "-created_at"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = serializer.instance
        data = serializer.data
        if instance and hasattr(instance, "_raw_secret") and instance._raw_secret:
            data["secret"] = instance._raw_secret
        headers = self.get_success_headers(data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"], url_path="rotate")
    def rotate(self, request, pk=None):
        endpoint = self.get_object()

        # Shift active secret to old secret
        endpoint.encrypted_old_secret = endpoint.encrypted_secret
        endpoint.old_secret_expires_at = timezone.now() + timezone.timedelta(hours=24)

        from .models import generate_secret

        new_secret = generate_secret()
        endpoint.secret = new_secret
        endpoint.save()

        return Response(
            {
                "status": "success",
                "message": "Webhook secret rotated successfully. The old secret remains valid for 24 hours.",
                "secret": new_secret,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="test")
    def test_endpoint(self, request, pk=None):
        """
        Triggers a test ping webhook event payload to verify endpoint connectivity.
        """
        endpoint = self.get_object()
        ping_payload = {
            "event": "ping",
            "message": "Webhook connection test from Open Source Contribution Atelier",
            "timestamp": timezone.now().isoformat(),
            "endpoint_id": str(endpoint.id),
        }

        delivery = WebhookDelivery.objects.create(
            endpoint=endpoint,
            event_type="ping",
            payload=ping_payload,
            status="pending",
            attempt_count=0,
        )

        try:
            # Trigger immediate delivery attempt
            deliver_webhook(delivery.id, attempt=1)
            delivery.refresh_from_db()
        except (json.JSONDecodeError, KeyError, ValidationError) as e:
            delivery.status = "failed"
            delivery.response_body = str(e)
            delivery.save()
            return Response(
                {
                    "error": "Invalid webhook payload or processing error",
                    "details": str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            delivery.status = "failed"
            delivery.response_body = str(e)
            delivery.save()
            return Response(
                {
                    "error": "Internal server error during webhook delivery",
                    "details": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = WebhookDeliverySerializer(delivery)
        return Response(
            {
                "message": f"Test ping sent to {endpoint.target_url}",
                "delivery": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class WebhookDeliveryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WebhookDeliverySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WebhookDelivery.objects.filter(
            endpoint__user=self.request.user
        ).order_by("-created_at")

    @action(detail=True, methods=["post"], url_path="replay")
    def replay(self, request, pk=None):
        """
        Manually replays a failed or completed webhook delivery payload.
        """
        delivery = self.get_object()

        # Reset status and attempt count for replay
        delivery.status = "pending"
        delivery.attempt_count = 0
        delivery.save()

        try:
            deliver_webhook(delivery.id, attempt=1)
            delivery.refresh_from_db()
        except (json.JSONDecodeError, KeyError, ValidationError) as e:
            delivery.status = "failed"
            delivery.response_body = str(e)
            delivery.save()
            return Response(
                {
                    "error": "Invalid webhook payload or processing error",
                    "details": str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            delivery.status = "failed"
            delivery.response_body = str(e)
            delivery.save()
            return Response(
                {
                    "error": "Internal server error during webhook delivery",
                    "details": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = self.get_serializer(delivery)
        return Response(
            {
                "message": f"Delivery {delivery.id} replayed successfully.",
                "delivery": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"])
    def health(self, request):
        """
        Returns the failed delivery ratio over the last 24 hours.
        """
        twenty_four_hours_ago = timezone.now() - timezone.timedelta(hours=24)
        recent_deliveries = self.get_queryset().filter(
            created_at__gte=twenty_four_hours_ago
        )
        total = recent_deliveries.count()

        if total == 0:
            return Response({"failed_ratio": 0.0, "total": 0, "failed": 0})

        failed = recent_deliveries.filter(
            status__in=["failed", "dead", "retrying"]
        ).count()
        ratio = round((failed / total) * 100, 2)

        return Response({"failed_ratio": ratio, "total": total, "failed": failed})
