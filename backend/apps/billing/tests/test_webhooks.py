import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.billing.models import CustomerSubscription, Invoice, Payment
from apps.billing.webhooks import stripe_webhook

User = get_user_model()


@override_settings(TESTING=True)
class StripeWebhookIdempotencyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="stripe-webhook-user",
            email="stripe-webhook@example.com",
            password="test-password",
        )
        CustomerSubscription.objects.create(
            user=self.user,
            stripe_customer_id="cus_idempotency",
            stripe_subscription_id="sub_idempotency",
            active=True,
            status="active",
        )

    def _post(self, event_type, event_object):
        return self.client.post(
            "/api/billing/webhook/",
            data=json.dumps(
                {
                    "id": "evt_retryable",
                    "type": event_type,
                    "data": {"object": event_object},
                }
            ),
            content_type="application/json",
        )

    @patch("apps.billing.webhooks.async_task")
    def test_retried_invoice_paid_is_idempotent(self, mock_async_task):
        event = {
            "id": "in_retry",
            "customer": "cus_idempotency",
            "amount_paid": 1999,
            "currency": "usd",
            "charge": "ch_retry",
        }

        first = self._post("invoice.paid", event)
        second = self._post("invoice.paid", event)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(
            Invoice.objects.filter(stripe_invoice_id="in_retry").count(), 1
        )
        self.assertEqual(
            Payment.objects.filter(stripe_charge_id="ch_retry").count(), 1
        )
        mock_async_task.assert_called_once()

    @patch("apps.billing.webhooks.async_task")
    def test_retried_failed_invoice_is_idempotent(self, mock_async_task):
        event = {
            "id": "in_failed_retry",
            "customer": "cus_idempotency",
            "amount_due": 999,
            "currency": "usd",
        }

        first = self._post("invoice.payment_failed", event)
        second = self._post("invoice.payment_failed", event)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(
            Invoice.objects.filter(stripe_invoice_id="in_failed_retry").count(), 1
        )
        self.assertEqual(
            Payment.objects.filter(
                stripe_charge_id="ch_failed_in_failed_retry"
            ).count(),
            1,
        )
        mock_async_task.assert_not_called()
