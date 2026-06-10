import json
from django.utils.deprecation import MiddlewareMixin
from .models import SandboxExecutionLog

class SandboxExecutionLogMiddleware(MiddlewareMixin):
    def process_request(self, request):
        if request.path == "/api/sandbox/verify/" and request.method == "POST":
            try:
                # Read request body to cache it in request._body 
                # before DRF consumes the stream in the view.
                _ = request.body
            except Exception:
                pass

    def process_response(self, request, response):
        if request.path == "/api/sandbox/verify/" and request.method == "POST":
            if response.status_code == 200:
                try:
                    req_data = json.loads(request.body.decode("utf-8"))
                except Exception:
                    req_data = {}

                try:
                    res_data = json.loads(response.content.decode("utf-8"))
                except Exception:
                    res_data = {}

                if req_data and res_data:
                    command = req_data.get("command", "")
                    expected_command = req_data.get("expected_command", "")
                    
                    accepted = res_data.get("accepted", False)
                    feedback = res_data.get("feedback", "")
                    score_delta = res_data.get("score_delta", 0)
                    
                    user = request.user if hasattr(request, "user") and request.user.is_authenticated else None

                    SandboxExecutionLog.objects.create(
                        user=user,
                        command=command,
                        expected_command=expected_command,
                        accepted=accepted,
                        feedback=feedback,
                        score_delta=score_delta,
                    )
        return response
