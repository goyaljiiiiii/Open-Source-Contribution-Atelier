import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db.models.signals import (
    m2m_changed,
    post_delete,
    post_save,
    pre_delete,
    pre_save,
)
from django.dispatch import receiver

from apps.audit.middleware import get_audit_context
from apps.audit.models import AuditEvent
from apps.rbac.models import Role, UserRole

logger = logging.getLogger(__name__)
User = get_user_model()


def get_users_permissions(users):
    """
    Returns a dict mapping user_id -> sorted list of [app_label, codename]
    """
    user_ids = [u.id for u in users]
    if not user_ids:
        return {}

    perms = {uid: set() for uid in user_ids}

    # Group permissions
    group_perms = User.groups.through.objects.filter(user_id__in=user_ids).values_list(
        "user_id",
        "group__permissions__content_type__app_label",
        "group__permissions__codename",
    )
    for uid, app_label, codename in group_perms:
        if app_label and codename:
            perms[uid].add((app_label, codename))

    # Role permissions
    role_perms = UserRole.objects.filter(user_id__in=user_ids).values_list(
        "user_id", "role__permissions__slug"
    )
    for uid, slug in role_perms:
        if slug:
            if "." in slug:
                app_label, codename = slug.split(".", 1)
            else:
                app_label, codename = ("rbac", slug)
            perms[uid].add((app_label, codename))

    return {uid: sorted([list(p) for p in perms[uid]]) for uid in user_ids}


def _create_audit_events(users, before_perms, after_perms):
    dry_run = getattr(settings, "RBAC_AUDIT_DRY_RUN", False)
    ctx = get_audit_context()
    actor = ctx.get("actor")

    events = []
    for user in users:
        before = before_perms.get(user.id, [])
        after = after_perms.get(user.id, [])

        if before == after:
            continue

        if dry_run:
            logger.info(
                f"DRY_RUN: RBAC Audit Event for User {user.id}. Before: {before}, After: {after}"
            )
            continue

        events.append(
            AuditEvent(
                actor=actor,
                action=AuditEvent.ACTION_UPDATED,
                resource_type="User",
                resource_id=str(user.id),
                before=before,
                after=after,
                ip_address=ctx.get("ip_address"),
                user_agent=ctx.get("user_agent", ""),
                correlation_id=ctx.get("correlation_id", ""),
                extra={"rbac": True},
            )
        )

    if events and not dry_run:
        AuditEvent.objects.bulk_create(events)


@receiver(pre_save, sender=UserRole)
def user_role_pre_save(sender, instance, **kwargs):
    if instance.user_id:
        instance._rbac_audit_users = [instance.user]
        instance._rbac_audit_before = get_users_permissions(instance._rbac_audit_users)


@receiver(post_save, sender=UserRole)
def user_role_post_save(sender, instance, **kwargs):
    users = getattr(instance, "_rbac_audit_users", None)
    if users:
        after = get_users_permissions(users)
        _create_audit_events(users, instance._rbac_audit_before, after)


@receiver(pre_delete, sender=UserRole)
def user_role_pre_delete(sender, instance, **kwargs):
    if instance.user_id:
        instance._rbac_audit_users = [instance.user]
        instance._rbac_audit_before = get_users_permissions(instance._rbac_audit_users)


@receiver(post_delete, sender=UserRole)
def user_role_post_delete(sender, instance, **kwargs):
    users = getattr(instance, "_rbac_audit_users", None)
    if users:
        after = get_users_permissions(users)
        _create_audit_events(users, instance._rbac_audit_before, after)


@receiver(m2m_changed, sender=Role.permissions.through)
def role_permissions_changed(sender, instance, action, reverse, pk_set, **kwargs):
    if action in ["pre_add", "pre_remove", "pre_clear"]:
        if reverse:
            if action == "pre_clear":
                users = list(
                    User.objects.filter(
                        user_roles__role__permissions=instance
                    ).distinct()
                )
            else:
                users = list(
                    User.objects.filter(user_roles__role_id__in=pk_set or []).distinct()
                )
        else:
            users = list(User.objects.filter(user_roles__role=instance).distinct())

        instance._rbac_audit_users = users
        instance._rbac_audit_before = get_users_permissions(users)

    elif action in ["post_add", "post_remove", "post_clear"]:
        users = getattr(instance, "_rbac_audit_users", None)
        if users:
            after = get_users_permissions(users)
            _create_audit_events(users, instance._rbac_audit_before, after)


@receiver(m2m_changed, sender=Group.permissions.through)
def group_permissions_changed(sender, instance, action, reverse, pk_set, **kwargs):
    if action in ["pre_add", "pre_remove", "pre_clear"]:
        if reverse:
            if action == "pre_clear":
                users = list(
                    User.objects.filter(groups__permissions=instance).distinct()
                )
            else:
                users = list(
                    User.objects.filter(groups__id__in=pk_set or []).distinct()
                )
        else:
            users = list(instance.user_set.all())

        instance._rbac_audit_users = users
        instance._rbac_audit_before = get_users_permissions(users)

    elif action in ["post_add", "post_remove", "post_clear"]:
        users = getattr(instance, "_rbac_audit_users", None)
        if users:
            after = get_users_permissions(users)
            _create_audit_events(users, instance._rbac_audit_before, after)


@receiver(m2m_changed, sender=User.groups.through)
def user_groups_changed(sender, instance, action, reverse, pk_set, **kwargs):
    if action in ["pre_add", "pre_remove", "pre_clear"]:
        if reverse:
            if action == "pre_clear":
                users = list(instance.user_set.all())
            else:
                users = list(User.objects.filter(id__in=pk_set or []).distinct())
        else:
            users = [instance]

        instance._rbac_audit_users = users
        instance._rbac_audit_before = get_users_permissions(users)

    elif action in ["post_add", "post_remove", "post_clear"]:
        users = getattr(instance, "_rbac_audit_users", None)
        if users:
            after = get_users_permissions(users)
            _create_audit_events(users, instance._rbac_audit_before, after)
