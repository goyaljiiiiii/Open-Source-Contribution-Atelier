import os
import re

from django.apps import apps
from django.conf import settings
from django.core.checks import Tags, Warning, register
from django.db.models.signals import post_save


def get_post_save_receivers(model):
    """Check if the given model has any post_save receivers registered."""
    for receiver in post_save.receivers:
        # receiver is a tuple, typically (lookup_key, receiver)
        # lookup_key usually looks like (_make_id(sender), dispatch_uid)
        # However, checking post_save._live_receivers(model) is more robust
        pass

    # Actually Django's Signal class has _live_receivers() which requires sender
    receivers = post_save._live_receivers(model)
    return len(receivers) > 0


def find_bulk_create_usages(model_name):
    """Scan backend/apps/ codebase for `.objects.bulk_create` of the given model."""
    pattern = re.compile(rf"\b{model_name}\.objects\.bulk_create\b")
    found_usages = []

    base_dir = os.path.join(settings.BASE_DIR, "apps")
    if not os.path.exists(base_dir):
        return found_usages

    for root, dirs, files in os.walk(base_dir):
        # Skip test directories
        if "tests" in root:
            continue

        for file in files:
            if not file.endswith(".py") or file.startswith("test_"):
                continue

            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if pattern.search(content):
                        found_usages.append(file_path)
            except Exception:
                pass

    return found_usages


@register(Tags.models)
def check_bulk_create_bypass(app_configs, **kwargs):
    errors = []

    try:
        from apps.search.mixins import SearchIndexMixin
    except ImportError:
        return errors

    for model in apps.get_models():
        if issubclass(model, SearchIndexMixin):
            has_signals = get_post_save_receivers(model)
            if has_signals:
                usages = find_bulk_create_usages(model.__name__)
                if usages:
                    files_str = ", ".join(os.path.basename(u) for u in usages)
                    errors.append(
                        Warning(
                            f"Model '{model.__name__}' uses SearchIndexMixin and has post_save signals, "
                            f"but bulk_create() is called in: {files_str}. "
                            "These signals will be bypassed during bulk_create (though search indexing will still run).",
                            hint="Ensure no critical post_save logic is missed during bulk_create.",
                            obj=model,
                            id="search.W001",
                        )
                    )

    return errors
