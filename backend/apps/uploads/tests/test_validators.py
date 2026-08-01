from pathlib import Path

import pytest
from django.core.exceptions import ValidationError

from apps.uploads.validators import sanitize_svg_bytes, validate_file


@pytest.mark.parametrize(
    ("filename", "content", "expected_mime"),
    [
        ("image.png", b"\x89PNG\r\n\x1a\n" + b"x" * 32, "image/png"),
        ("document.pdf", b"%PDF-1.7\n" + b"x" * 32, "application/pdf"),
        ("archive.zip", b"PK\x03\x04" + b"x" * 32, "application/zip"),
    ],
)
def test_magic_byte_validation_accepts_matching_files(
    tmp_path, filename, content, expected_mime
):
    path = tmp_path / filename
    path.write_bytes(content)
    _, mime = validate_file(path, filename, "project")
    assert mime == expected_mime


def test_php_file_renamed_as_png_is_rejected(tmp_path):
    path = tmp_path / "renamed.png"
    path.write_bytes(b"<?php echo 'owned'; ?>")
    with pytest.raises(ValidationError):
        validate_file(path, "renamed.png", "project")


def test_extension_must_match_magic_bytes(tmp_path):
    path = tmp_path / "fake.png"
    path.write_bytes(b"%PDF-1.7\n")
    with pytest.raises(ValidationError, match="does not match"):
        validate_file(path, "fake.png", "project")


def test_svg_sanitizer_removes_active_content():
    raw = b"""<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
      <rect width="10" height="10" fill="red"/>
      <script>alert(1)</script>
      <foreignObject><body>bad</body></foreignObject>
      <a href="javascript:alert(1)"><text>bad link</text></a>
    </svg>"""
    sanitized = sanitize_svg_bytes(raw).decode("utf-8")
    assert "script" not in sanitized
    assert "foreignObject" not in sanitized
    assert "onload" not in sanitized
    assert "javascript:" not in sanitized
    assert "rect" in sanitized


@pytest.mark.parametrize(
    "filename",
    [
        "exploit.php.png",
        "script.sh.png",
        "payload.exe.jpg",
        "shell.phtml.webp",
        "malware.bat.gif",
    ],
)
def test_dangerous_multi_extension_files_are_rejected(tmp_path, filename):
    path = tmp_path / filename
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"x" * 32)
    with pytest.raises(ValidationError, match="Prohibited executable file extension"):
        validate_file(path, filename, "project")


def test_zero_byte_files_are_rejected(tmp_path):
    path = tmp_path / "empty.png"
    path.write_bytes(b"")
    with pytest.raises(ValidationError, match="greater than zero"):
        validate_file(path, "empty.png", "avatar")


def test_exceeding_upload_type_size_limit_is_rejected(tmp_path):
    path = tmp_path / "large.png"
    # Create fake image larger than avatar 5MB limit
    content = b"\x89PNG\r\n\x1a\n" + b"x" * (6 * 1024 * 1024)
    path.write_bytes(content)
    with pytest.raises(ValidationError, match="exceeds the 5MB limit"):
        validate_file(path, "large.png", "avatar")

