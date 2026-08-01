"""
Public certificate verification and anti-cheat API views.

Note: ``views.py`` already exists as a module in this app, so these endpoints
live in this dedicated module to avoid a package/module name conflict.
"""

from __future__ import annotations

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.gamification.anti_cheat.detector import AntiCheatDetector
from apps.gamification.crypto.cert_signer import get_public_key_pem, verify_signature
from apps.gamification.models import SignedCertificate
from apps.progress.models import Certificate


def _client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class CertificateVerificationView(APIView):
    """
    GET /api/gamification/verify-certificate/<hash>/

    Looks up a ``SignedCertificate`` by verification hash (falling back to
    ``progress.Certificate``) and verifies the Ed25519 signature when present.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, hash: str):
        signed = SignedCertificate.objects.filter(
            verification_hash=hash, is_active=True
        ).select_related("user").first()

        if signed:
            payload = dict(signed.payload or {})
            public_pem = getattr(settings, "CERT_SIGNING_PUBLIC_KEY_PEM", "") or get_public_key_pem()
            signature_valid = verify_signature(
                payload, signed.signature, public_pem
            )
            return Response(
                {
                    "is_valid": signature_valid and signed.is_active,
                    "signature_valid": signature_valid,
                    "source": "signed_certificate",
                    "certificate": {
                        "verification_hash": signed.verification_hash,
                        "course_name": signed.course_name,
                        "public_key_fingerprint": signed.public_key_fingerprint,
                        "created_at": signed.created_at.isoformat(),
                        "user": signed.user.get_full_name()
                        or signed.user.username,
                    },
                },
                status=status.HTTP_200_OK,
            )

        try:
            legacy = Certificate.objects.get(verification_hash=hash)
        except Certificate.DoesNotExist:
            return Response(
                {
                    "is_valid": False,
                    "error": "Certificate not found or invalid hash.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "is_valid": legacy.is_active,
                "signature_valid": None,
                "source": "progress_certificate",
                "certificate": {
                    "verification_hash": legacy.verification_hash,
                    "course_name": legacy.course_name,
                    "issued_at": legacy.issued_at.isoformat(),
                    "user": legacy.user.get_full_name() or legacy.user.username,
                },
            },
            status=status.HTTP_200_OK,
        )


class AntiCheatCheckView(APIView):
    """
    POST /api/gamification/anti-cheat/check/

    Evaluate quiz/session telemetry and return a risk score with flags.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        question_count = int(data.get("question_count", 0))
        duration_seconds = float(data.get("duration_seconds", 0))
        keystroke_intervals = data.get("keystroke_intervals_ms")
        if keystroke_intervals is not None:
            keystroke_intervals = [float(v) for v in keystroke_intervals]

        detector = AntiCheatDetector(user=request.user, persist_flags=True)
        result = detector.evaluate_quiz_completion(
            question_count=question_count,
            duration_seconds=duration_seconds,
            keystroke_intervals_ms=keystroke_intervals,
            client_ip=_client_ip(request),
            extra_metadata=data.get("metadata") or {},
        )

        return Response(
            {
                "risk_score": result.risk_score,
                "flags": result.flags,
                "is_suspicious": result.is_suspicious,
                "metadata": result.metadata,
                "flag_ids": result.flag_ids,
            },
            status=status.HTTP_200_OK,
        )
