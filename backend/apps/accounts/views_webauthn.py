import base64
import json

from django.conf import settings
from django.http import JsonResponse
from django.views import View
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import WebAuthnCredential

try:
    from fido2.server import Fido2Server
    from fido2.webauthn import PublicKeyCredentialRpEntity

    rp = PublicKeyCredentialRpEntity(
        id=getattr(settings, "WEBAUTHN_RP_ID", "localhost"),
        name=getattr(settings, "WEBAUTHN_RP_NAME", "Open Source Atelier"),
    )
    fido2_server = Fido2Server(rp)
except ImportError:
    Fido2Server = None
    PublicKeyCredentialRpEntity = None
    fido2_server = None


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(data: str) -> bytes:
    padding = 4 - len(data) % 4
    data += "=" * padding
    return base64.urlsafe_b64decode(data)


class PasskeyRegisterBeginView(APIView):
    """
    POST /api/v1/auth/passkey/register/begin/

    Initiates WebAuthn passkey registration by generating a challenge
    for the client's authenticator.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        existing_credentials = WebAuthnCredential.objects.filter(user=user)
        credentials = [
            {
                "id": cred.credential_id,
                "public_key": cred.public_key,
                "sign_count": cred.sign_count,
            }
            for cred in existing_credentials
        ]

        user_verification = "preferred"

        registration_data, state = fido2_server.register_begin(
            {
                "id": str(user.pk).encode(),
                "name": user.email or user.username,
                "displayName": user.get_full_name() or user.username,
            },
            credentials,
            user_verification=user_verification,
        )

        request.session["webauthn_registration_state"] = state

        return Response(
            {
                "challenge": registration_data["challenge"],
                "rp": registration_data["rp"],
                "user": registration_data["user"],
                "pubKeyCredParams": registration_data["pubKeyCredParams"],
                "timeout": registration_data["timeout"],
                "attestation": registration_data["attestation"],
                "excludeCredentials": registration_data.get("excludeCredentials", []),
                "authenticatorSelection": registration_data.get(
                    "authenticatorSelection", {}
                ),
            },
            status=status.HTTP_200_OK,
        )


class PasskeyRegisterFinishView(APIView):
    """
    POST /api/v1/auth/passkey/register/finish/

    Completes WebAuthn passkey registration by verifying the
    authenticator's response and storing the credential.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        state = request.session.get("webauthn_registration_state")
        if not state:
            return Response(
                {"detail": "Registration session not found. Please restart registration."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client_data = request.data.get("clientDataJSON")
        attestation_object = request.data.get("attestationObject")
        nickname = request.data.get("nickname", "")

        if not client_data or not attestation_object:
            return Response(
                {"detail": "Missing clientDataJSON or attestationObject."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            client_data_bytes = _b64decode(client_data)
            attestation_bytes = _b64decode(attestation_object)

            auth_data = fido2_server.register_complete(
                state,
                client_data_bytes,
                attestation_bytes,
            )
        except Exception as e:
            return Response(
                {"detail": f"Registration verification failed: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        credential_id = auth_data.credential_data.credential_id
        public_key = auth_data.credential_data.public_key
        sign_count = auth_data.sign_count

        if WebAuthnCredential.objects.filter(credential_id=credential_id).exists():
            return Response(
                {"detail": "This passkey is already registered."},
                status=status.HTTP_409_CONFLICT,
            )

        credential = WebAuthnCredential.objects.create(
            user=user,
            credential_id=credential_id,
            public_key=public_key,
            sign_count=sign_count,
            nickname=nickname,
        )

        request.session.pop("webauthn_registration_state", None)

        return Response(
            {
                "detail": "Passkey registered successfully.",
                "credential_id": _b64encode(credential_id),
                "nickname": credential.nickname,
                "created_at": credential.created_at.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )
