
"""
Search models for full-text search, embeddings, and analytics.
"""


from django.conf import settings

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField, SearchVector
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid
import json


class SearchDocument(models.Model):
    """
    A unified model to store searchable text from all entities across the application.
    Enables highly performant Postgres Full-Text Search and Trigram similarity queries
    without needing a heavy external search engine.
    """

    # ============================================================
    # Core Fields
    # ============================================================
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")

    title = models.CharField(max_length=255)
    body_text = models.TextField()

    # Search vector for full-text search
    search_vector = SearchVectorField(null=True, blank=True)
    
    # ============================================================
    # Additional Search Fields
    # ============================================================
    
    # Metadata
    summary = models.TextField(blank=True, help_text="Short summary for search results")
    tags = models.JSONField(default=list, blank=True, help_text="Search tags")
    category = models.CharField(max_length=100, blank=True, db_index=True)
    difficulty = models.CharField(
        max_length=20,
        choices=[
            ('beginner', 'Beginner'),
            ('intermediate', 'Intermediate'),
            ('advanced', 'Advanced'),
            ('expert', 'Expert'),
        ],
        default='beginner',
        blank=True
    )
    language = models.CharField(max_length=10, default='en')
    
    # ============================================================
    # Embeddings (for semantic search)
    # ============================================================
    
    embedding = models.JSONField(
        null=True, 
        blank=True, 
        help_text="Vector embedding for semantic search"
    )
    embedding_version = models.IntegerField(default=1)
    
    # ============================================================
    # Scoring & Analytics
    # ============================================================
    
    popularity_score = models.FloatField(default=0.0, help_text="Popularity based on views/completions")
    engagement_score = models.FloatField(default=0.0, help_text="User engagement score")
    search_count = models.IntegerField(default=0, help_text="Number of times this document appeared in search")
    click_count = models.IntegerField(default=0, help_text="Number of times this document was clicked")
    
    # ============================================================
    # Timestamps
    # ============================================================
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    indexed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # Fast full-text lookups
        indexes = [
            GinIndex(fields=["search_vector"], name="search_vector_gin_idx"),
            GinIndex(
                fields=["title"],
                name="trigram_title_gin_idx",
                opclasses=["gin_trgm_ops"],
            ),
            GinIndex(
                fields=["tags"],
                name="tags_gin_idx",
                opclasses=["gin_trgm_ops"],
            ),
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["category", "difficulty"]),
            models.Index(fields=["popularity_score"]),
        ]
        # Prevent duplicate index entries for the same object
        unique_together = ("content_type", "object_id")

    def __str__(self):
        return f"SearchDoc: {self.title} ({self.content_type.name})"

    
    # ============================================================
    # Search Methods
    # ============================================================
    
    def update_search_vector(self):
        """
        Update the search vector for full-text search.
        """
        from django.contrib.postgres.search import SearchVector
        
        self.search_vector = (
            SearchVector('title', weight='A') +
            SearchVector('summary', weight='B') +
            SearchVector('body_text', weight='C') +
            SearchVector('tags', weight='D') +
            SearchVector('category', weight='D')
        )
        self.indexed_at = timezone.now()
        self.save(update_fields=['search_vector', 'indexed_at'])
    
    def increment_search_count(self):
        """Increment search count."""
        self.search_count += 1
        self.save(update_fields=['search_count', 'updated_at'])
    
    def increment_click_count(self):
        """Increment click count."""
        self.click_count += 1
        self.save(update_fields=['click_count', 'updated_at'])
    
    def update_popularity_score(self):
        """Update popularity score based on engagement."""
        # Combine search count, click count, and engagement score
        self.popularity_score = (
            (self.search_count * 0.1) +
            (self.click_count * 0.3) +
            (self.engagement_score * 0.6)
        )
        self.save(update_fields=['popularity_score', 'updated_at'])
    
    # ============================================================
    # Embedding Methods
    # ============================================================
    
    def generate_embedding(self):
        """
        Generate embedding for semantic search.
        """
        try:
            import openai
            from django.conf import settings
            
            # Prepare text for embedding
            text = f"{self.title} {self.summary} {self.body_text}"[:8000]
            
            # Generate embedding using OpenAI
            response = openai.Embedding.create(
                model="text-embedding-ada-002",
                input=text
            )
            self.embedding = response['data'][0]['embedding']
            self.embedding_version = 2
            self.save(update_fields=['embedding', 'embedding_version', 'updated_at'])
            return True
            
        except Exception as e:
            # Fallback to local model
            try:
                from sentence_transformers import SentenceTransformer
                model = SentenceTransformer('all-MiniLM-L6-v2')
                text = f"{self.title} {self.summary} {self.body_text}"[:8000]
                self.embedding = model.encode(text).tolist()
                self.embedding_version = 1
                self.save(update_fields=['embedding', 'embedding_version', 'updated_at'])
                return True
            except:
                return False
    
    # ============================================================
    # Serialization
    # ============================================================
    
    def to_search_result(self, highlight=None):
        """
        Convert to search result dictionary.
        
        Args:
            highlight: Optional highlighted text snippet
        
        Returns:
            dict: Search result data
        """
        return {
            'id': str(self.id),
            'title': self.title,
            'summary': self.summary or self.body_text[:200],
            'content_type': self.content_type.name,
            'object_id': self.object_id,
            'category': self.category,
            'difficulty': self.difficulty,
            'tags': self.tags,
            'popularity_score': self.popularity_score,
            'search_count': self.search_count,
            'click_count': self.click_count,
            'created_at': self.created_at.isoformat(),
            'highlight': highlight or self.summary or self.body_text[:200],
        }


class SearchQuery(models.Model):
    """
    Track search queries for analytics.
    """
    
    QUERY_TYPES = [
        ('full_text', 'Full Text'),
        ('trigram', 'Trigram Similarity'),
        ('semantic', 'Semantic Search'),
        ('hybrid', 'Hybrid Search'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Query details
    query = models.TextField()
    query_type = models.CharField(max_length=20, choices=QUERY_TYPES, default='full_text')
    
    # Filters
    content_types = models.JSONField(default=list, blank=True)
    categories = models.JSONField(default=list, blank=True)
    difficulty = models.CharField(max_length=20, blank=True)
    tags = models.JSONField(default=list, blank=True)
    
    # Results
    result_count = models.IntegerField(default=0)
    clicked_document_ids = models.JSONField(default=list, blank=True)
    clicked_position = models.IntegerField(null=True, blank=True)
    
    # Timing
    response_time_ms = models.IntegerField(default=0)
    
    # IP and session
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    session_id = models.CharField(max_length=255, blank=True)
    user_agent = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['query']),
            models.Index(fields=['created_at']),
            models.Index(fields=['query_type']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.query} - {self.created_at}"
    
    def record_click(self, document_id: str, position: int):
        """
        Record a click on a search result.
        """
        if document_id not in self.clicked_document_ids:
            self.clicked_document_ids.append(document_id)
        self.clicked_position = position
        self.save(update_fields=['clicked_document_ids', 'clicked_position', 'updated_at'])
        
        # Update document click count
        try:
            doc = SearchDocument.objects.get(id=document_id)
            doc.increment_click_count()
            doc.update_popularity_score()
        except SearchDocument.DoesNotExist:
            pass


class SearchSuggestion(models.Model):
    """
    Search suggestions based on previous queries.
    """
    
    query = models.CharField(max_length=255, unique=True, db_index=True)
    frequency = models.IntegerField(default=0)
    last_searched = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-frequency']
        indexes = [
            models.Index(fields=['query', 'frequency']),
        ]
    
    def __str__(self):
        return self.query
    
    def increment_frequency(self):
        """Increment search frequency."""
        self.frequency += 1
        self.save(update_fields=['frequency', 'last_searched'])


class SearchAnalytics(models.Model):
    """
    Search analytics and metrics aggregated by day.
    """
    
    date = models.DateField(unique=True, db_index=True)
    
    # Metrics
    total_searches = models.IntegerField(default=0)
    unique_users = models.IntegerField(default=0)
    zero_result_searches = models.IntegerField(default=0)
    avg_response_time = models.FloatField(default=0.0)
    click_through_rate = models.FloatField(default=0.0)
    
    # Top items
    top_queries = models.JSONField(default=list)
    top_content_types = models.JSONField(default=list)
    popular_tags = models.JSONField(default=list)
    popular_categories = models.JSONField(default=list)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-date']
        db_table = 'search_analytics'
        indexes = [
            models.Index(fields=['date']),
        ]
    
    def __str__(self):
        return f"Search Analytics - {self.date}"
    
    @classmethod
    def aggregate_for_date(cls, date=None):
        """
        Aggregate search analytics for a specific date.
        """
        if date is None:
            date = timezone.now().date()
        
        # Get all queries for the date
        start_date = timezone.make_aware(timezone.datetime.combine(date, timezone.datetime.min.time()))
        end_date = start_date + timezone.timedelta(days=1)
        
        queries = SearchQuery.objects.filter(created_at__gte=start_date, created_at__lt=end_date)
        
        if not queries.exists():
            return
        
        # Calculate metrics
        total_searches = queries.count()
        unique_users = queries.values('user').distinct().count()
        zero_result = queries.filter(result_count=0).count()
        avg_response = queries.aggregate(avg=models.Avg('response_time_ms'))['avg'] or 0.0
        
        # Get top queries
        top_queries = list(
            queries.values('query')
            .annotate(count=models.Count('id'))
            .order_by('-count')[:10]
        )
        
        # Get top content types
        top_content_types = list(
            queries.values('content_types')
            .annotate(count=models.Count('id'))
            .order_by('-count')[:10]
        )
        
        # Get popular tags
        all_tags = []
        for q in queries:
            all_tags.extend(q.tags)
        from collections import Counter
        tag_counts = Counter(all_tags)
        popular_tags = [{'tag': tag, 'count': count} for tag, count in tag_counts.most_common(10)]
        
        # Create or update analytics
        analytics, created = cls.objects.get_or_create(
            date=date,
            defaults={
                'total_searches': total_searches,
                'unique_users': unique_users,
                'zero_result_searches': zero_result,
                'avg_response_time': avg_response,
                'top_queries': top_queries,
                'top_content_types': top_content_types,
                'popular_tags': popular_tags,
            }
        )
        
        if not created:
            analytics.total_searches = total_searches
            analytics.unique_users = unique_users
            analytics.zero_result_searches = zero_result
            analytics.avg_response_time = avg_response
            analytics.top_queries = top_queries
            analytics.top_content_types = top_content_types
            analytics.popular_tags = popular_tags
            analytics.save()
        
        return analytics



class SearchAnalytics(models.Model):
    query = models.CharField(max_length=500, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    result_count = models.IntegerField(default=0)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name_plural = "search analytics"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["query", "created_at"]),
        ]

    def __str__(self):
        return f"Search: {self.query} ({self.result_count} results)"

