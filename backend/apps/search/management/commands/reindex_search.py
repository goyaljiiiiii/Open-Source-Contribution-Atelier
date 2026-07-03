"""
Management command to reindex search content.
"""

from django.core.management.base import BaseCommand
from apps.search.services.search_indexer import SearchIndexer


class Command(BaseCommand):
    """
    Reindex all searchable content.
    """
    
    help = 'Reindex all searchable content'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--type',
            type=str,
            help='Content type to reindex (lesson, module)'
        )
        parser.add_argument(
            '--id',
            type=int,
            help='Specific content ID to reindex'
        )
    
    def handle(self, *args, **options):
        if options.get('type') and options.get('id'):
            content_type = options['type']
            content_id = options['id']
            self.stdout.write(f"Reindexing {content_type} {content_id}...")
            result = SearchIndexer.index_content(content_type, content_id, force=True)
            if result:
                self.stdout.write(f"✅ Reindexed {content_type} {content_id}")
            else:
                self.stdout.write(f"❌ Failed to reindex {content_type} {content_id}")
        else:
            self.stdout.write("Reindexing all content...")
            SearchIndexer.reindex_all()
            self.stdout.write("✅ Reindex complete!")