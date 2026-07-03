"""
Search indexer for maintaining searchable content.
"""

import logging
from typing import Dict, Any, List, Optional
from django.db import transaction
from django.core.cache import cache
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from apps.search.models import SearchableContent
from apps.content.models import Lesson, Module
from apps.progress.models import UserProgress

logger = logging.getLogger(__name__)


class SearchIndexer:
    """
    Indexer for searchable content.
    """
    
    @classmethod
    def index_content(cls, content_type: str, content_id: int, force: bool = False) -> Optional[SearchableContent]:
        """
        Index content for search.
        
        Args:
            content_type: Type of content ('lesson', 'module', etc.)
            content_id: Content ID
            force: Force re-index
        
        Returns:
            SearchableContent: Indexed content
        """
        # Get content based on type
        content_data = cls._get_content_data(content_type, content_id)
        if not content_data:
            return None
        
        # Create or update searchable content
        searchable, created = SearchableContent.objects.get_or_create(
            content_type=content_type,
            content_id=content_id
        )
        
        # Update fields
        searchable.title = content_data.get('title', '')
        searchable.description = content_data.get('description', '')
        searchable.content = content_data.get('content', '')
        searchable.tags = content_data.get('tags', [])
        searchable.difficulty = content_data.get('difficulty', 'beginner')
        searchable.category = content_data.get('category', '')
        searchable.author = content_data.get('author', '')
        searchable.language = content_data.get('language', 'en')
        
        # Calculate popularity score
        searchable.popularity_score = cls._calculate_popularity(content_type, content_id)
        
        # Update search vector
        searchable.update_search_vector()
        
        # Generate embedding
        if getattr(settings, 'SEMANTIC_SEARCH_ENABLED', False):
            cls._update_embedding(searchable)
        
        searchable.save()
        
        logger.info(f"Indexed {content_type} {content_id}")
        return searchable
    
    @classmethod
    def delete_index(cls, content_type: str, content_id: int):
        """Delete index for content."""
        try:
            searchable = SearchableContent.objects.get(
                content_type=content_type,
                content_id=content_id
            )
            searchable.delete()
            logger.info(f"Deleted index for {content_type} {content_id}")
        except SearchableContent.DoesNotExist:
            pass
    
    @classmethod
    def reindex_all(cls):
        """Reindex all content."""
        logger.info("Starting full reindex...")
        
        # Index lessons
        lessons = Lesson.objects.all()
        for lesson in lessons:
            cls.index_content('lesson', lesson.id, force=True)
        
        # Index modules
        modules = Module.objects.all()
        for module in modules:
            cls.index_content('module', module.id, force=True)
        
        logger.info(f"Reindexed {len(lessons)} lessons and {len(modules)} modules")
    
    @classmethod
    def _get_content_data(cls, content_type: str, content_id: int) -> Optional[Dict[str, Any]]:
        """Get content data for indexing."""
        data = {}
        
        if content_type == 'lesson':
            try:
                lesson = Lesson.objects.get(id=content_id)
                data = {
                    'title': lesson.title,
                    'description': lesson.description or '',
                    'content': lesson.content or '',
                    'tags': lesson.tags or [],
                    'difficulty': getattr(lesson, 'difficulty', 'beginner'),
                    'category': getattr(lesson, 'category', ''),
                    'author': getattr(lesson, 'author', ''),
                }
            except Lesson.DoesNotExist:
                return None
        
        elif content_type == 'module':
            try:
                module = Module.objects.get(id=content_id)
                data = {
                    'title': module.title,
                    'description': module.description or '',
                    'content': ' '.join([l.content for l in module.lessons.all()]),
                    'tags': module.tags or [],
                    'difficulty': getattr(module, 'difficulty', 'intermediate'),
                    'category': getattr(module, 'category', ''),
                    'author': getattr(module, 'author', ''),
                }
            except Module.DoesNotExist:
                return None
        
        return data
    
    @classmethod
    def _calculate_popularity(cls, content_type: str, content_id: int) -> float:
        """Calculate popularity score based on user engagement."""
        score = 0.0
        
        # Count views/completions from UserProgress
        if content_type == 'lesson':
            completed = UserProgress.objects.filter(
                lesson_id=content_id,
                completed=True
            ).count()
            score += completed * 0.1
        
        # Additional metrics could include views, likes, etc.
        
        return min(score, 100.0)  # Cap at 100
    
    @classmethod
    def _update_embedding(cls, searchable: SearchableContent):
        """Update embedding for semantic search."""
        try:
            text = f"{searchable.title} {searchable.description} {searchable.content}"
            
            # Try OpenAI
            import openai
            response = openai.Embedding.create(
                model="text-embedding-ada-002",
                input=text[:8000]  # Limit text length
            )
            searchable.embedding = response['data'][0]['embedding']
            
        except Exception as e:
            logger.warning(f"Failed to generate embedding: {e}")
            searchable.embedding = None
            searchable.embedding_version = 0


# ============================================================
# Django Signals
# ============================================================

@receiver(post_save)
def index_on_save(sender, instance, created, **kwargs):
    """Index content when saved."""
    if sender in [Lesson, Module]:
        content_type = sender.__name__.lower()
        SearchIndexer.index_content(content_type, instance.id)


@receiver(post_delete)
def delete_on_delete(sender, instance, **kwargs):
    """Delete index when content deleted."""
    if sender in [Lesson, Module]:
        content_type = sender.__name__.lower()
        SearchIndexer.delete_index(content_type, instance.id)