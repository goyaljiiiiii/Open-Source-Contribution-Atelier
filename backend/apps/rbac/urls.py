"""
URL configuration for RBAC app.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = "rbac"

# ============================================================
# VIEWSET ROUTER (for ViewSets)
# ============================================================

# router = DefaultRouter()
# router.register(r'permissions', views.PermissionViewSet, basename='permission')
# router.register(r'roles', views.RoleViewSet, basename='role')
# router.register(r'assignments', views.UserRoleAssignmentViewSet, basename='assignment')
# router.register(r'audit-logs', views.PermissionAuditLogViewSet, basename='audit-log')

# ============================================================
# URL PATTERNS (for APIView based endpoints)
# ============================================================

urlpatterns = [
    # ============================================================
    # PERMISSION ENDPOINTS
    # ============================================================
    path("permissions/", views.PermissionListView.as_view(), name="list_permissions"),
    path("permissions/<int:pk>/", views.PermissionDetailView.as_view(), name="permission_detail"),
    path("permissions/create/", views.PermissionCreateView.as_view(), name="create_permission"),
    path("permissions/<int:pk>/update/", views.PermissionUpdateView.as_view(), name="update_permission"),
    path("permissions/<int:pk>/delete/", views.PermissionDeleteView.as_view(), name="delete_permission"),
    
    # ============================================================
    # ROLE ENDPOINTS
    # ============================================================
    path("roles/", views.RoleListView.as_view(), name="list_roles"),
    path("roles/<int:pk>/", views.RoleDetailView.as_view(), name="role_detail"),
    path("roles/create/", views.RoleCreateView.as_view(), name="create_role"),
    path("roles/<int:pk>/update/", views.RoleUpdateView.as_view(), name="update_role"),
    path("roles/<int:pk>/delete/", views.RoleDeleteView.as_view(), name="delete_role"),
    path("roles/<int:role_id>/assign-permissions/", views.RoleAssignPermissionsView.as_view(), name="assign_role_permissions"),
    
    # ============================================================
    # USER ROLE ASSIGNMENT ENDPOINTS
    # ============================================================
    path("assign/", views.AssignRoleView.as_view(), name="assign_role"),
    path("bulk-assign/", views.BulkAssignRolesView.as_view(), name="bulk_assign_roles"),
    path("revoke/", views.RevokeRoleView.as_view(), name="revoke_role"),
    
    # ============================================================
    # USER PERMISSION ENDPOINTS
    # ============================================================
    path("users/me/roles/", views.MyRolesView.as_view(), name="my_roles"),
    path("users/me/permissions/", views.MyPermissionsView.as_view(), name="my_permissions"),
    path("users/<int:user_id>/roles/", views.UserRolesView.as_view(), name="user_roles"),
    path("users/<int:user_id>/permissions/", views.UserPermissionsView.as_view(), name="user_permissions"),
    
    # ============================================================
    # AUDIT LOG ENDPOINTS
    # ============================================================
    path("audit-logs/", views.AuditLogListView.as_view(), name="list_audit_logs"),
    path("audit-logs/<int:pk>/", views.AuditLogDetailView.as_view(), name="audit_log_detail"),
    
    # ============================================================
    # UTILITY ENDPOINTS
    # ============================================================
    path("initialize/", views.InitializePermissionsView.as_view(), name="initialize_permissions"),
    path("check/permission/", views.CheckPermissionView.as_view(), name="check_permission"),
    path("check/role/", views.CheckRoleView.as_view(), name="check_role"),
]

# ============================================================
# OPTIONAL: Include router URLs if using ViewSets
# ============================================================
# urlpatterns += router.urls