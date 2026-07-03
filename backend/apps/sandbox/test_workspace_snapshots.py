import pytest
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from .models import Project, ProjectFile, WorkspaceSnapshot, SnapshotFile

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def user():
    return User.objects.create_user(username="snap_user1", password="password")

@pytest.fixture
def user2():
    return User.objects.create_user(username="snap_user2", password="password")

@pytest.fixture
def project(user):
    return Project.objects.create(user=user, name="My Awesome Project")

@pytest.fixture
def setup_files(project):
    ProjectFile.objects.create(project=project, path="src/index.js", content="console.log('v1');")
    ProjectFile.objects.create(project=project, path="src/utils.js", content="export const sum = (a,b) => a+b;")

@pytest.mark.django_db
class TestWorkspaceSnapshotEdgeCases:

    def test_unauthenticated_access(self, api_client):
        response = api_client.get("/api/sandbox/workspace-snapshots/")
        assert response.status_code == 401

    def test_create_snapshot(self, api_client, user, project, setup_files):
        api_client.force_authenticate(user=user)
        response = api_client.post("/api/sandbox/workspace-snapshots/", {
            "project": str(project.id),
            "name": "Version 1",
            "description": "Initial state",
            "metadata": {"layout": "default"}
        }, format='json')
        
        assert response.status_code == 201, response.data
        assert WorkspaceSnapshot.objects.count() == 1
        snapshot = WorkspaceSnapshot.objects.first()
        assert snapshot.name == "Version 1"
        assert snapshot.files.count() == 2
        paths = [f.path for f in snapshot.files.all()]
        assert "src/index.js" in paths
        assert "src/utils.js" in paths

    def test_cross_user_isolation(self, api_client, user, user2, project, setup_files):
        # user creates snapshot
        api_client.force_authenticate(user=user)
        res = api_client.post("/api/sandbox/workspace-snapshots/", {
            "project": str(project.id),
            "name": "User 1 Snapshot",
        }, format='json')
        assert res.status_code == 201
        snapshot_id = res.data['id']

        # user2 tries to read snapshots
        api_client.force_authenticate(user=user2)
        res2 = api_client.get("/api/sandbox/workspace-snapshots/")
        assert res2.status_code == 200
        assert len(res2.data) == 0  # Should be empty for user2

        # user2 tries to restore user's snapshot
        res3 = api_client.post(f"/api/sandbox/workspace-snapshots/{snapshot_id}/restore/")
        assert res3.status_code == 404 # Should not be found since queryset filters by project__user

    def test_restore_edge_cases(self, api_client, user, project, setup_files):
        api_client.force_authenticate(user=user)
        
        # 1. Create snapshot of initial state
        res = api_client.post("/api/sandbox/workspace-snapshots/", {
            "project": str(project.id),
            "name": "Milestone 1",
        }, format='json')
        snapshot_id = res.data['id']

        # 2. Modify workspace (User messes up their code)
        index_file = ProjectFile.objects.get(project=project, path="src/index.js")
        index_file.content = "console.log('Messed up code');"
        index_file.save()
        
        utils_file = ProjectFile.objects.get(project=project, path="src/utils.js")
        utils_file.delete() # User accidentally deletes a file
        
        ProjectFile.objects.create(project=project, path="src/new_file.js", content="junk data") # User creates a junk file
        
        assert ProjectFile.objects.filter(project=project).count() == 2

        # 3. Restore the snapshot
        res_restore = api_client.post(f"/api/sandbox/workspace-snapshots/{snapshot_id}/restore/")
        assert res_restore.status_code == 200
        
        # 4. Assert perfect recovery
        assert ProjectFile.objects.filter(project=project).count() == 2
        restored_index = ProjectFile.objects.get(project=project, path="src/index.js")
        assert restored_index.content == "console.log('v1');" # modification reverted
        
        restored_utils = ProjectFile.objects.filter(project=project, path="src/utils.js")
        assert restored_utils.exists() # deleted file is back
        
        junk_files = ProjectFile.objects.filter(project=project, path="src/new_file.js")
        assert not junk_files.exists() # junk file is gone

