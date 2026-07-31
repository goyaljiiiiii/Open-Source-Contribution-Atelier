from django.db import models, transaction

from apps.events.services.event_bus import EventBus


class SearchIndexQuerySet(models.QuerySet):
    def bulk_create(self, objs, **kwargs):
        created_objs = super().bulk_create(objs, **kwargs)

        def enqueue_indexing():
            for obj in created_objs:
                # We emit the SearchIndexRequested event which is handled
                # asynchronously by Django-Q in search/handlers.py
                EventBus.emit(
                    "SearchIndexRequested",
                    {
                        "app_label": obj._meta.app_label,
                        "model_name": obj._meta.model_name,
                        "object_id": obj.pk,
                        "title": getattr(obj, "title", str(obj)),
                        "description": getattr(
                            obj, "summary", getattr(obj, "description", "")
                        ),
                        "tags": getattr(obj, "category", getattr(obj, "tags", "")),
                        "body_text": getattr(
                            obj, "content", getattr(obj, "body_text", "")
                        ),
                    },
                )

        transaction.on_commit(enqueue_indexing)
        return created_objs


class SearchIndexManager(models.Manager):
    def get_queryset(self):
        return SearchIndexQuerySet(self.model, using=self._db)


class SearchIndexMixin(models.Model):
    """
    An abstract model mixin that ensures objects created via bulk_create
    are enqueued for search indexing. This patches the gap where bulk_create
    bypasses Django's post_save signals.
    """

    objects = SearchIndexManager()

    class Meta:
        abstract = True
