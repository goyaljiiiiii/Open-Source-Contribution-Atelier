from django.apps import apps
from django.core.management.base import BaseCommand

from apps.search.meili_client import get_meili_index
from apps.search.mixins import SearchIndexMixin
from apps.search.models import SearchDocument


class Command(BaseCommand):
    help = "Checks the drift between the database and Meilisearch index."

    def handle(self, *args, **options):
        self.stdout.write("Checking Meilisearch index drift...")
        index = get_meili_index()
        if not index:
            self.stdout.write(self.style.ERROR("Meilisearch client unavailable."))
            return

        ms_ids = set()
        limit = 1000
        offset = 0
        while True:
            res = index.get_documents(
                {"limit": limit, "offset": offset, "fields": ["id"]}
            )
            docs = res.results if hasattr(res, "results") else res
            if not docs:
                break
            ms_ids.update(str(d["id"]) for d in docs)
            offset += limit

        all_db_docs = list(SearchDocument.objects.values_list("id", flat=True))
        db_ids = set(str(pk) for pk in all_db_docs)

        missing_in_ms = db_ids - ms_ids
        stale_in_ms = ms_ids - db_ids

        self.stdout.write(
            self.style.WARNING(
                f"Documents missing in Meilisearch: {len(missing_in_ms)}"
            )
        )
        self.stdout.write(
            self.style.WARNING(f"Stale documents in Meilisearch: {len(stale_in_ms)}")
        )

        if not missing_in_ms and not stale_in_ms:
            self.stdout.write(
                self.style.SUCCESS("No drift detected! Indexes are perfectly in sync.")
            )
        else:
            self.stdout.write(
                self.style.ERROR(
                    f"Drift detected! Total {len(missing_in_ms) + len(stale_in_ms)} documents out of sync."
                )
            )
