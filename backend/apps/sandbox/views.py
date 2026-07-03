from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CodeSnapshot
from .serializers import CodeSnapshotSerializer
from .services import verify_git_command


class SandboxVerifySerializer(serializers.Serializer):
    command = serializers.CharField()
    expected_command = serializers.CharField()


class SandboxVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = SandboxVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = verify_git_command(
            serializer.validated_data["command"],
            serializer.validated_data["expected_command"],
        )
        return Response(
            {
                "accepted": result.accepted,
                "feedback": result.feedback,
                "score_delta": result.score_delta,
            },
            status=status.HTTP_200_OK,
        )


class CodeSnapshotViewSet(viewsets.ModelViewSet):
    serializer_class = CodeSnapshotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CodeSnapshot.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)



from .models import Project, ProjectFile
from .serializers import ProjectSerializer, ProjectFileSerializer

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def replace(self, request, pk=None):
        project = self.get_object()
        query = request.data.get("query")
        replacement = request.data.get("replacement")
        is_regex = request.data.get("is_regex", False)
        match_case = request.data.get("match_case", False)
        
        if not query:
            return Response({"error": "Query is required"}, status=400)
            
        import re
        flags = 0 if match_case else re.IGNORECASE
        try:
            pattern = re.compile(query if is_regex else re.escape(query), flags)
        except re.error:
            return Response({"error": "Invalid regular expression"}, status=400)
            
        files = ProjectFile.objects.filter(project=project)
        previous_state = {}
        updated_files = []
        
        from django.db import transaction
        from .models import BulkReplaceOperation
        with transaction.atomic():
            for f in files:
                if pattern.search(f.content):
                    previous_state[str(f.id)] = f.content
                    f.content = pattern.sub(replacement, f.content)
                    updated_files.append(f)
            
            if previous_state:
                BulkReplaceOperation.objects.create(
                    project=project,
                    user=request.user,
                    previous_state=previous_state
                )
                ProjectFile.objects.bulk_update(updated_files, ["content"])
                
        return Response({"modified_count": len(updated_files)})

    @action(detail=True, methods=["post"])
    def undo_replace(self, request, pk=None):
        project = self.get_object()
        from .models import BulkReplaceOperation
        operation = BulkReplaceOperation.objects.filter(project=project, user=request.user).order_by("-created_at").first()
        
        if not operation:
            return Response({"error": "No recent operation to undo"}, status=400)
            
        from django.db import transaction
        with transaction.atomic():
            files_to_update = []
            for file_id, content in operation.previous_state.items():
                f = ProjectFile.objects.filter(id=file_id).first()
                if f:
                    f.content = content
                    files_to_update.append(f)
            
            if files_to_update:
                ProjectFile.objects.bulk_update(files_to_update, ["content"])
            operation.delete()
            
        return Response({"restored_count": len(files_to_update)})


class ProjectFileViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectFileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ProjectFile.objects.filter(project__user=self.request.user)


from .models import CodeExecutionTrace
from .serializers import CodeExecutionTraceSerializer

class CodeExecutionTraceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CodeExecutionTraceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CodeExecutionTrace.objects.filter(user=self.request.user)


from .models import CodeReviewThread
from .serializers import CodeReviewThreadSerializer

class CodeReviewThreadViewSet(viewsets.ModelViewSet):
    serializer_class = CodeReviewThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = CodeReviewThread.objects.prefetch_related('comments', 'comments__user').all()
        session_id = self.request.query_params.get('session', None)
        if session_id is not None:
            queryset = queryset.filter(session_id=session_id)
        return queryset


from rest_framework.decorators import action
from django.db import transaction
from .models import WorkspaceSnapshot, SnapshotFile
from .serializers import WorkspaceSnapshotSerializer, SnapshotFileSerializer

class WorkspaceSnapshotViewSet(viewsets.ModelViewSet):
    serializer_class = WorkspaceSnapshotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        return WorkspaceSnapshot.objects.filter(Q(project__user=self.request.user) | Q(is_public=True)).distinct()

    def perform_create(self, serializer):
        project_id = self.request.data.get('project')
        with transaction.atomic():
            snapshot = serializer.save()
            project = snapshot.project
            
            for pfile in project.files.all():
                SnapshotFile.objects.create(
                    snapshot=snapshot,
                    path=pfile.path,
                    content=pfile.content,
                    language=pfile.language
                )

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        snapshot = self.get_object()
        project = snapshot.project
        
        with transaction.atomic():
            project.files.all().delete()
            
            for sfile in snapshot.files.all():
                ProjectFile.objects.create(
                    project=project,
                    path=sfile.path,
                    content=sfile.content,
                    language=sfile.language
                )
                
        return Response({'status': 'restored'})

    @action(detail=True, methods=['post'])
    def fork(self, request, pk=None):
        snapshot = self.get_object()
        
        with transaction.atomic():
            new_project = Project.objects.create(
                user=request.user,
                name=f"Fork of {snapshot.name}"
            )
            
            for sfile in snapshot.files.all():
                ProjectFile.objects.create(
                    project=new_project,
                    path=sfile.path,
                    content=sfile.content,
                    language=sfile.language
                )
                
        from .serializers import ProjectSerializer
        return Response(ProjectSerializer(new_project).data, status=status.HTTP_201_CREATED)
from .models import SnippetCollection, CodeSnippet
from .serializers import SnippetCollectionSerializer, CodeSnippetSerializer

class SnippetCollectionViewSet(viewsets.ModelViewSet):
    serializer_class = SnippetCollectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SnippetCollection.objects.filter(user=self.request.user)


class CodeSnippetViewSet(viewsets.ModelViewSet):
    serializer_class = CodeSnippetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = CodeSnippet.objects.filter(user=self.request.user)
        
        # Filtering
        collection_id = self.request.query_params.get('collection', None)
        if collection_id is not None:
            queryset = queryset.filter(collection_id=collection_id)
            
        is_favorite = self.request.query_params.get('is_favorite', None)
        if is_favorite is not None:
            queryset = queryset.filter(is_favorite=is_favorite.lower() == 'true')
            
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(title__icontains=search)
            
        return queryset


