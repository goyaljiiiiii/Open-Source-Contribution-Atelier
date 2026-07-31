import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.models import Permission as DjangoPermission
from hypothesis import given
from hypothesis import settings as hypothesis_settings
from hypothesis.strategies import data, lists, sampled_from

from apps.audit.models import AuditEvent
from apps.rbac.models import Permission, Role, UserRole
from apps.rbac.signals import get_users_permissions

User = get_user_model()


@pytest.fixture
def setup_rbac_data(db):
    user = User.objects.create_user(username="testuser", password="password")

    # Create some django permissions
    dj_perms = list(DjangoPermission.objects.all()[:5])

    # Create some groups
    group1 = Group.objects.create(name="Group 1")
    group2 = Group.objects.create(name="Group 2")

    # Create some custom permissions
    p1 = Permission.objects.create(slug="app.read")
    p2 = Permission.objects.create(slug="app.write")
    p3 = Permission.objects.create(slug="other.admin")

    # Create roles
    role1 = Role.objects.create(name="Role 1")
    role2 = Role.objects.create(name="Role 2")

    return {
        "user": user,
        "dj_perms": dj_perms,
        "groups": [group1, group2],
        "custom_perms": [p1, p2, p3],
        "roles": [role1, role2],
    }


@pytest.mark.django_db(transaction=True)
@hypothesis_settings(max_examples=50)
@given(st_data=data())
def test_rbac_audit_trail_hypothesis(setup_rbac_data, st_data):
    user = setup_rbac_data["user"]
    groups = setup_rbac_data["groups"]
    roles = setup_rbac_data["roles"]
    custom_perms = setup_rbac_data["custom_perms"]
    dj_perms = setup_rbac_data["dj_perms"]

    AuditEvent.objects.all().delete()

    # We will perform a sequence of random actions
    actions = st_data.draw(
        lists(
            sampled_from(
                [
                    "add_group",
                    "remove_group",
                    "add_role",
                    "remove_role",
                    "add_perm_to_group",
                    "remove_perm_from_group",
                    "add_perm_to_role",
                    "remove_perm_from_role",
                ]
            ),
            min_size=1,
            max_size=10,
        )
    )

    for action in actions:
        before_perms = get_users_permissions([user]).get(user.id, [])

        if action == "add_group":
            group = st_data.draw(sampled_from(groups))
            user.groups.add(group)
        elif action == "remove_group":
            group = st_data.draw(sampled_from(groups))
            user.groups.remove(group)
        elif action == "add_role":
            role = st_data.draw(sampled_from(roles))
            UserRole.objects.get_or_create(user=user, role=role)
        elif action == "remove_role":
            role = st_data.draw(sampled_from(roles))
            UserRole.objects.filter(user=user, role=role).delete()
        elif action == "add_perm_to_group":
            group = st_data.draw(sampled_from(groups))
            perm = st_data.draw(sampled_from(dj_perms))
            group.permissions.add(perm)
        elif action == "remove_perm_from_group":
            group = st_data.draw(sampled_from(groups))
            perm = st_data.draw(sampled_from(dj_perms))
            group.permissions.remove(perm)
        elif action == "add_perm_to_role":
            role = st_data.draw(sampled_from(roles))
            perm = st_data.draw(sampled_from(custom_perms))
            role.permissions.add(perm)
        elif action == "remove_perm_from_role":
            role = st_data.draw(sampled_from(roles))
            perm = st_data.draw(sampled_from(custom_perms))
            role.permissions.remove(perm)

        after_perms = get_users_permissions([user]).get(user.id, [])

        # Verify the audit event
        if before_perms != after_perms:
            event = (
                AuditEvent.objects.filter(
                    resource_id=str(user.id), extra__has_key="rbac"
                )
                .order_by("-created_at")
                .first()
            )
            assert event is not None
            assert event.before == before_perms
            assert event.after == after_perms
