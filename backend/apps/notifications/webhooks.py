import logging

import requests

logger = logging.getLogger(__name__)


def dispatch_outgoing_webhook(
    url: str, payload: dict, secret: str, attempt_number: int = 1
):
    """
    Executes a structured HTTP POST signature delivery to external receiver endpoints.
    Injects retry sequence telemetry headers for clear consumer tracking.
    """
    # Create required identification headers
    headers = {
        "Content-Type": "application/json",
        "X-Atelier-Webhook-Secret": secret,
        # Acceptance Criteria: Attach the exact delivery sequence integer value
        "X-Atelier-Delivery-Attempt": str(attempt_number),
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        # Raise HTTPError exceptions for bad status codes (4xx/5xx) to trigger task retry logic
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        logger.error(
            f"[WEBHOOK ATTEMPT {attempt_number} FAILED] Destination: {url} | Error: {str(e)}"
        )
        raise e
