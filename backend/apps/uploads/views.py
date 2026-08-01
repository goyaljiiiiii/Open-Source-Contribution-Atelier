import os
import shutil
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.text import get_valid_filename
from rest_framework import permissions, status, views
from rest_framework.response import Response

from .models import UploadSession
from .validators import (
    max_size_for,
    sanitize_svg_file,
    validate_declared_size,
    validate_file,
    validate_filename_extensions,
)
import unicodedata
import uuid



def sanitize_filename_ascii(filename: str) -> str:
    ascii_name = (
        unicodedata.normalize("NFKD", filename)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    valid = get_valid_filename(ascii_name)
    if not valid or valid.startswith("."):
        valid = f"file_{uuid.uuid4().hex[:8]}{valid}"
    return valid


class StartUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        filename = Path(str(request.data.get("filename", ""))).name
        total_size = request.data.get("total_size")
        total_chunks = request.data.get("total_chunks")
        upload_type = request.data.get("upload_type", UploadSession.UploadType.PROJECT)

        if not filename or total_size is None or total_chunks is None:
            return Response(
                {"error": "Missing required fields"}, status=status.HTTP_400_BAD_REQUEST
            )
        if upload_type not in UploadSession.UploadType.values:
            return Response(
                {"error": "Invalid upload type"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            validate_filename_extensions(filename)
            total_size = int(total_size)
            total_chunks = int(total_chunks)
            if total_chunks <= 0:
                raise ValueError
            validate_declared_size(total_size, upload_type)

        except (TypeError, ValueError, ValidationError) as exc:
            message = (
                exc.messages[0]
                if isinstance(exc, ValidationError)
                else "Invalid upload metadata"
            )
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)

        session = UploadSession.objects.create(
            user=request.user,
            filename=sanitize_filename_ascii(filename),
            upload_type=upload_type,
            total_size=total_size,
            total_chunks=total_chunks,
        )
        session.get_temp_dir()
        return Response(
            {
                "session_id": session.session_id,
                "upload_id": session.session_id,
                "status": session.status,
            },
            status=status.HTTP_201_CREATED,
        )


class UploadChunkView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = UploadSession.objects.get(
                session_id=session_id, user=request.user
            )
        except UploadSession.DoesNotExist:
            return Response(
                {"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            chunk_index = int(request.data.get("chunk_index", -1))
        except (TypeError, ValueError):
            chunk_index = -1
        file_chunk = request.FILES.get("chunk")

        if chunk_index < 0 or chunk_index >= session.total_chunks or not file_chunk:
            return Response(
                {"error": "Invalid or missing chunk data"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if session.status not in {
            UploadSession.Status.PENDING,
            UploadSession.Status.UPLOADING,
        }:
            return Response(
                {"error": "Upload no longer accepts chunks"},
                status=status.HTTP_409_CONFLICT,
            )
        if chunk_index in session.uploaded_chunks:
            return Response(
                {"message": "Chunk already uploaded"}, status=status.HTTP_200_OK
            )

        MAX_CHUNK_SIZE = 10 * 1024 * 1024  # 10MB limit per chunk
        if file_chunk.size > MAX_CHUNK_SIZE:
            return Response(
                {"error": "Chunk size exceeds maximum allowed limit of 10MB"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        temp_dir = session.get_temp_dir()
        chunk_path = os.path.join(temp_dir, f"{chunk_index}.part")
        with open(chunk_path, "wb+") as destination:
            for chunk in file_chunk.chunks():
                destination.write(chunk)

        # Verify cumulative size of uploaded chunks on disk doesn't exceed upload type limit
        max_allowed = max_size_for(session.upload_type)
        current_total = sum(
            os.path.getsize(os.path.join(temp_dir, f))
            for f in os.listdir(temp_dir)
            if f.endswith(".part")
        )
        if current_total > max_allowed:
            os.remove(chunk_path)
            return Response(
                {
                    "error": f"Total uploaded size exceeds allowed limit of {max_allowed // (1024 * 1024)}MB for {session.upload_type}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.uploaded_chunks = [*session.uploaded_chunks, chunk_index]
        session.status = UploadSession.Status.UPLOADING
        session.save(update_fields=["uploaded_chunks", "status", "updated_at"])

        return Response(
            {"message": "Chunk uploaded successfully"}, status=status.HTTP_200_OK
        )


class CompleteUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = UploadSession.objects.get(
                session_id=session_id, user=request.user
            )
        except UploadSession.DoesNotExist:
            return Response(
                {"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if len(set(session.uploaded_chunks)) != session.total_chunks:
            return Response(
                {"error": "Missing chunks", "uploaded": session.uploaded_chunks},
                status=status.HTTP_400_BAD_REQUEST,
            )

        temp_dir = session.get_temp_dir()
        quarantine_root = Path(
            getattr(
                settings, "UPLOAD_QUARANTINE_ROOT", settings.BASE_DIR / "quarantine"
            )
        )
        quarantine_root.mkdir(parents=True, exist_ok=True)
        quarantine_path = quarantine_root / f"{session.session_id}_{session.filename}"

        try:
            with quarantine_path.open("wb") as final_file:
                for index in range(session.total_chunks):
                    chunk_path = Path(temp_dir) / f"{index}.part"
                    if not chunk_path.exists():
                        raise FileNotFoundError(f"Chunk {index} not found on disk")
                    with chunk_path.open("rb") as chunk_file:
                        shutil.copyfileobj(chunk_file, final_file)

            if quarantine_path.stat().st_size != session.total_size:
                raise ValidationError("Uploaded size does not match declared size.")

            detected_type, mime_type = validate_file(
                quarantine_path, session.filename, session.upload_type
            )
            if detected_type == "svg":
                sanitize_svg_file(quarantine_path)
        except (ValidationError, FileNotFoundError) as exc:
            quarantine_path.unlink(missing_ok=True)
            session.status = UploadSession.Status.REJECTED
            session.scan_message = (
                exc.messages[0] if isinstance(exc, ValidationError) else str(exc)
            )
            session.save(update_fields=["status", "scan_message", "updated_at"])
            return Response(
                {"error": session.scan_message}, status=status.HTTP_400_BAD_REQUEST
            )
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

        session.status = UploadSession.Status.QUARANTINED
        session.detected_mime_type = mime_type
        session.quarantine_path = str(quarantine_path)
        session.scan_message = "File is being scanned..."
        session.save()
        enqueue_upload_scan(str(session.session_id))

        return Response(
            {
                "message": "File is being scanned...",
                "upload_id": session.session_id,
                "session_id": session.session_id,
                "status": session.status,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class UploadStatusView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, session_id):
        try:
            session = UploadSession.objects.get(
                session_id=session_id, user=request.user
            )
        except UploadSession.DoesNotExist:
            return Response(
                {"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND
            )

        payload = {
            "session_id": session.session_id,
            "upload_id": session.session_id,
            "status": session.status,
            "message": session.scan_message,
            "uploaded_chunks": session.uploaded_chunks,
            "total_chunks": session.total_chunks,
            "mime_type": session.detected_mime_type,
            "file_path": session.file_path if session.is_accessible else None,
        }
        return Response(payload)


class DirectUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        uploaded_file = request.FILES.get("file") or request.FILES.get("image")
        if not uploaded_file:
            return Response(
                {"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST
            )

        upload_type = request.data.get("upload_type", UploadSession.UploadType.PROJECT)
        if upload_type not in UploadSession.UploadType.values:
            return Response(
                {"error": "Invalid upload type"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            validate_declared_size(uploaded_file.size, upload_type)
        except ValidationError as exc:
            return Response(
                {"error": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST
            )

        valid_name = sanitize_filename_ascii(uploaded_file.name)
        quarantine_root = Path(
            getattr(
                settings, "UPLOAD_QUARANTINE_ROOT", settings.BASE_DIR / "quarantine"
            )
        )
        quarantine_root.mkdir(parents=True, exist_ok=True)
        quarantine_path = quarantine_root / f"{uuid.uuid4()}_{valid_name}"

        with open(quarantine_path, "wb+") as dest:
            for chunk in uploaded_file.chunks():
                dest.write(chunk)

        try:
            detected_type, mime_type = validate_file(
                quarantine_path, valid_name, upload_type
            )
            if detected_type == "svg":
                sanitize_svg_file(quarantine_path)
        except (ValidationError, FileNotFoundError) as exc:
            quarantine_path.unlink(missing_ok=True)
            message = exc.messages[0] if isinstance(exc, ValidationError) else str(exc)
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)

        session = UploadSession.objects.create(
            user=request.user,
            filename=valid_name,
            upload_type=upload_type,
            total_size=uploaded_file.size,
            total_chunks=1,
            uploaded_chunks=[0],
            status=UploadSession.Status.QUARANTINED,
            detected_mime_type=mime_type,
            quarantine_path=str(quarantine_path),
            scan_message="File is being scanned...",
        )
        enqueue_upload_scan(str(session.session_id))

        return Response(
            {
                "message": "File is being scanned...",
                "upload_id": session.session_id,
                "session_id": session.session_id,
                "status": session.status,
            },
            status=status.HTTP_202_ACCEPTED,
        )
