import pytest
import datetime
from django.urls import reverse
from django.utils import timezone
from unittest.mock import patch
from apps.gamification.models import SignedCertificate
from apps.progress.models import Certificate
from django.contrib.auth import get_user_model

User = get_user_model()

@pytest.fixture
def test_user(db):
    return User.objects.create_user(username="testuser", password="password")

@pytest.fixture
def setup_certificates(test_user, db):
    # Setup legacy certificate
    legacy_cert = Certificate.objects.create(
        user=test_user,
        course_name="Test Course",
        verification_hash="legacy-hash-123",
        is_active=True,
    )

    # Setup signed certificate
    signed_cert = SignedCertificate.objects.create(
        user=test_user,
        course_name="Test Signed Course",
        verification_hash="signed-hash-123",
        signature="dummy-signature",
        is_active=True,
        payload={}
    )
    
    return legacy_cert, signed_cert

@pytest.mark.django_db
@patch('apps.gamification.certificate_verification_view.verify_signature')
def test_signed_certificate_not_expired(mock_verify, api_client, setup_certificates):
    mock_verify.return_value = True
    _, signed_cert = setup_certificates
    
    signed_cert.payload = {
        "expires_at": (timezone.now() + datetime.timedelta(days=10)).isoformat()
    }
    signed_cert.save()

    url = f"/api/gamification/verify-certificate/{signed_cert.verification_hash}/"
    response = api_client.get(url)
    
    assert response.status_code == 200
    assert response.data["is_valid"] is True
    assert response.data["is_expired"] is False

@pytest.mark.django_db
@patch('apps.gamification.certificate_verification_view.verify_signature')
def test_signed_certificate_expired(mock_verify, api_client, setup_certificates):
    mock_verify.return_value = True
    _, signed_cert = setup_certificates
    
    signed_cert.payload = {
        "expires_at": (timezone.now() - datetime.timedelta(days=10)).isoformat()
    }
    signed_cert.save()

    url = f"/api/gamification/verify-certificate/{signed_cert.verification_hash}/"
    response = api_client.get(url)
    
    assert response.status_code == 200
    assert response.data["is_valid"] is False
    assert response.data["is_expired"] is True

@pytest.mark.django_db
def test_legacy_certificate_not_expired(api_client, setup_certificates):
    legacy_cert, _ = setup_certificates
    
    legacy_cert.issued_at = timezone.now() - datetime.timedelta(days=365)
    legacy_cert.save()

    url = f"/api/gamification/verify-certificate/{legacy_cert.verification_hash}/"
    response = api_client.get(url)
    
    assert response.status_code == 200
    assert response.data["is_valid"] is True
    assert response.data["is_expired"] is False

@pytest.mark.django_db
def test_legacy_certificate_expired(api_client, setup_certificates):
    legacy_cert, _ = setup_certificates
    
    # expired (older than 5 years)
    legacy_cert.issued_at = timezone.now() - datetime.timedelta(days=365 * 6)
    legacy_cert.save()

    url = f"/api/gamification/verify-certificate/{legacy_cert.verification_hash}/"
    response = api_client.get(url)
    
    assert response.status_code == 200
    assert response.data["is_valid"] is False
    assert response.data["is_expired"] is True

@pytest.mark.django_db
@patch('apps.gamification.certificate_verification_view.verify_signature')
def test_signed_certificate_no_expiry_info(mock_verify, api_client, setup_certificates):
    mock_verify.return_value = True
    _, signed_cert = setup_certificates
    
    signed_cert.payload = {}
    signed_cert.save()

    url = f"/api/gamification/verify-certificate/{signed_cert.verification_hash}/"
    response = api_client.get(url)
    
    assert response.status_code == 200
    assert response.data["is_valid"] is True
    assert response.data["is_expired"] is False
