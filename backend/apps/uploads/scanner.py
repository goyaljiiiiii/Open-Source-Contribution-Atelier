"""ClamAV integration for quarantined uploads."""

from __future__ import annotations

import shutil
import subprocess
import uuid
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings


class ScannerUnavailable(RuntimeError):
    pass


class ScanTimeout(RuntimeError):
    pass


@dataclass(frozen=True)
class ScanResult:
    infected: bool
    signature: str = ""


def _tmp_upload_path(filename: str) -> Path:
    tmp_dir = Path(settings.MEDIA_ROOT) / "tmp_uploads"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(filename).name
    return tmp_dir / f"{uuid.uuid4().hex}_{safe_name}"


def _safe_unlink(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def _parse_scan_signature(stdout: str) -> str:
    for line in stdout.splitlines():
        if " FOUND" in line:
            _, _, rest = line.partition(": ")
            signature, _, _ = rest.partition(" FOUND")
            return signature.strip()
    return ""


def scan_file(file_path: str) -> ScanResult:
    """Scan an upload via a ClamAV subprocess and purge its temporary copy."""

    source = Path(file_path)
    temp_path = _tmp_upload_path(source.name)
    timeout = int(getattr(settings, "UPLOAD_SCAN_TIMEOUT", 15))
    command = tuple(
        getattr(settings, "CLAMAV_SCAN_COMMAND", ("clamscan", "--no-summary"))
    )

    try:
        shutil.copy2(source, temp_path)
        try:
            completed = subprocess.run(
                [*command, str(temp_path)],
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise ScanTimeout("Upload scan subprocess timed out.") from exc
        except FileNotFoundError as exc:
            raise ScannerUnavailable("ClamAV scanner binary is unavailable.") from exc

        if completed.returncode == 0:
            return ScanResult(infected=False)
        if completed.returncode == 1:
            return ScanResult(
                infected=True,
                signature=_parse_scan_signature(completed.stdout),
            )
        raise ScannerUnavailable(
            completed.stderr.strip() or "ClamAV scan failed unexpectedly."
        )
    finally:
        _safe_unlink(temp_path)
