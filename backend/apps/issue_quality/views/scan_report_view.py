"""
API views for AST security scan reports.
"""

from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.issue_quality.models import ScanReport
from apps.issue_quality.tasks.scan_pr_task import scan_pr_code_sync

logger = logging.getLogger(__name__)


class ScanReportView(APIView):
    """
    POST /scan/ — submit files for scanning.
    GET  /scan/<id>/ — retrieve a stored report.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        files = request.data.get("files")
        if not isinstance(files, list) or not files:
            return Response(
                {"error": "files must be a non-empty list of {path, content} objects"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for item in files:
            if not isinstance(item, dict) or "path" not in item or "content" not in item:
                return Response(
                    {"error": "Each file must have 'path' and 'content' keys"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        report_data = scan_pr_code_sync(files)

        scan_report = ScanReport.objects.create(
            files=[f["path"] for f in files],
            report=report_data,
            risk_score=report_data["risk_score"],
        )

        return Response(
            {
                "id": scan_report.pk,
                **report_data,
            },
            status=status.HTTP_201_CREATED,
        )

    def get(self, request, pk: int):
        try:
            scan_report = ScanReport.objects.get(pk=pk)
        except ScanReport.DoesNotExist:
            return Response(
                {"error": "Scan report not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "id": scan_report.pk,
                "files": scan_report.files,
                "risk_score": scan_report.risk_score,
                "created_at": scan_report.created_at.isoformat(),
                **scan_report.report,
            }
        )
