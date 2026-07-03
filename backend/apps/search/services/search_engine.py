"""
Advanced search engine with full-text search, fuzzy matching, and AI semantic search.
"""

import logging
import json
import time
from typing import Dict, Any, List, Optional, Tuple
from django.db import models
from django.db.models import Q, F, Value, FloatField
from django.db.models.functions import Greatest
from django.contrib.postgres.search import (
    SearchQuery, SearchRank, SearchVector,
    SearchHeadline, TrigramSimilarity
)
from django.contrib.postgres.aggregates import StringAgg
from django.core.cache import cache
from django.conf import settings
import numpy as np
from apps.search.models import SearchableContent, SearchQuery, SearchAnalytics, SearchSuggestion

logger = logging.getLogger(__name__)


class SearchEngine:
    """
    Advanced search engine with multiple search strategies.
    """
    
    CACHE_TTL = 300  # 5 minutes
    MAX_SEARCH_RESULTS = 100
    
    def __init__(self):
        self.semantic_enabled = getattr(settings, 'SEMANTIC_SEARCH_ENABLED', False)
    
    def search(
        self,
        query: str,
        user=None,
        content_types: List[str] = None,
        difficulty: str = None,
        tags: List[str] = None,
        limit: int = 20,
        offset: int = 0,
        search_type: str = 'hybrid'
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Perform advanced search with multiple strategies.
        
        Args:
            query: Search query
            user: User for personalization
            content_types: Filter by content types
            difficulty: Filter by difficulty
            tags: Filter by tags
            limit: Results limit
            offset: Results offset
            search_type: 'full_text', 'trigram', 'semantic', 'hybrid'
        
        Returns:
            Tuple of (results, total_count)
        """
        start_time = time.time()
        results = []
        total_count = 0
        
        try:
            # Clean query
            query = query.strip()
            if not query:
                return [], 0
            
            # Get base queryset
            base_qs = SearchableContent.objects.all()
            
            # Apply filters
            base_qs = self._apply_filters(base_qs, content_types, difficulty, tags)
            
            # Perform search based on type
            if search_type == 'semantic' and self.semantic_enabled:
                results, total_count = self._semantic_search(query, base_qs, limit, offset)
            elif search_type == 'trigram':
                results, total_count = self._trigram_search(query, base_qs, limit, offset)
            elif search_type == 'full_text':
                results, total_count = self._full_text_search(query, base_qs, limit, offset)
            else:  # hybrid
                results, total_count = self._hybrid_search(query, base_qs, limit, offset)
            
            # Enhance results with search highlights
            results = self._add_highlights(results, query)
            
            # Log search query
            self._log_search_query(query, user, content_types, difficulty, tags, len(results), start_time)
            
            # Update suggestions
            self._update_suggestions(query)
            
            return results, total_count
            
        except Exception as e:
            logger.error(f"Search error: {e}", exc_info=True)
            return [], 0
    
    def _apply_filters(self, qs, content_types, difficulty, tags):
        """Apply filters to queryset."""
        if content_types:
            qs = qs.filter(content_type__in=content_types)
        if difficulty:
            qs = qs.filter(difficulty=difficulty)
        if tags:
            for tag in tags:
                qs = qs.filter(tags__contains=[tag])
        return qs
    
    def _full_text_search(self, query: str, qs, limit: int, offset: int):
        """Perform PostgreSQL full-text search."""
        # Create search query
        search_query = SearchQuery(query, config='english')
        
        # Apply search
        qs = qs.annotate(
            rank=SearchRank(F('search_vector'), search_query),
            headline=SearchHeadline('content', search_query, start_sel='<mark>', stop_sel='</mark>')
        ).filter(search_vector=search_query).order_by('-rank')
        
        # Get total count
        total_count = qs.count()
        
        # Get results
        results = self._serialize_results(qs[offset:offset + limit])
        
        return results, total_count
    
    def _trigram_search(self, query: str, qs, limit: int, offset: int):
        """Perform trigram similarity search (fuzzy matching)."""
        # Apply trigram similarity
        qs = qs.annotate(
            similarity=Greatest(
                TrigramSimilarity('title', query),
                TrigramSimilarity('description', query),
                TrigramSimilarity('content', query)
            )
        ).filter(similarity__gt=0.1).order_by('-similarity')
        
        total_count = qs.count()
        results = self._serialize_results(qs[offset:offset + limit])
        
        return results, total_count
    
    def _semantic_search(self, query: str, qs, limit: int, offset: int):
        """Perform semantic search using embeddings."""
        # Generate query embedding
        query_embedding = self._get_embedding(query)
        if query_embedding is None:
            # Fallback to full-text search
            return self._full_text_search(query, qs, limit, offset)
        
        # Filter out items without embeddings
        qs = qs.filter(embedding__isnull=False)
        
        # Calculate cosine similarity
        results = []
        for item in qs:
            if item.embedding:
                similarity = self._cosine_similarity(query_embedding, item.embedding)
                results.append((item, similarity))
        
        # Sort by similarity
        results.sort(key=lambda x: x[1], reverse=True)
        
        total_count = len(results)
        results = results[offset:offset + limit]
        
        # Serialize results
        serialized = []
        for item, similarity in results:
            data = self._serialize_item(item)
            data['semantic_score'] = similarity
            serialized.append(data)
        
        return serialized, total_count
    
    def _hybrid_search(self, query: str, qs, limit: int, offset: int):
        """Perform hybrid search combining multiple strategies."""
        # Get results from full-text search
        ft_results, ft_total = self._full_text_search(query, qs, 50, 0)
        
        # Get results from trigram search
        tri_results, tri_total = self._trigram_search(query, qs, 50, 0)
        
        # Get semantic results if enabled
        sem_results = []
        if self.semantic_enabled:
            sem_results, sem_total = self._semantic_search(query, qs, 50, 0)
        
        # Combine and deduplicate results
        combined = {}
        
        for item in ft_results:
            combined[item['id']] = {'item': item, 'score': 1.0 * item.get('rank', 0.5)}
        
        for item in tri_results:
            if item['id'] in combined:
                combined[item['id']]['score'] += 0.5
                combined[item['id']]['score'] += item.get('similarity', 0)
            else:
                combined[item['id']] = {'item': item, 'score': 0.5 * item.get('similarity', 0)}
        
        for item in sem_results:
            if item['id'] in combined:
                combined[item['id']]['score'] += 0.8 * item.get('semantic_score', 0)
            else:
                combined[item['id']] = {'item': item, 'score': 0.8 * item.get('semantic_score', 0)}
        
        # Sort by combined score
        sorted_results = sorted(combined.values(), key=lambda x: x['score'], reverse=True)
        
        # Apply limit and offset
        paginated = sorted_results[offset:offset + limit]
        
        total_count = len(sorted_results)
        results = [r['item'] for r in paginated]
        
        return results, total_count
    
    def _get_embedding(self, text: str) -> Optional[np.ndarray]:
        """Get embedding for text using OpenAI or local model."""
        # Check cache first
        cache_key = f"embedding_{hash(text)}"
        cached = cache.get(cache_key)
        if cached is not None:
            return np.array(cached)
        
        try:
            # Try OpenAI embeddings
            import openai
            response = openai.Embedding.create(
                model="text-embedding-ada-002",
                input=text
            )
            embedding = np.array(response['data'][0]['embedding'])
            
            # Cache for 24 hours
            cache.set(cache_key, embedding.tolist(), 86400)
            
            return embedding
            
        except Exception as e:
            logger.warning(f"OpenAI embedding failed: {e}")
            # Try local model (sentence-transformers)
            try:
                from sentence_transformers import SentenceTransformer
                model = SentenceTransformer('all-MiniLM-L6-v2')
                embedding = model.encode(text)
                cache.set(cache_key, embedding.tolist(), 86400)
                return embedding
            except:
                return None
    
    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors."""
        if len(a) != len(b):
            return 0.0
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
    
    def _add_highlights(self, results: List[Dict], query: str):
        """Add search highlights to results."""
        for result in results:
            # Add highlighted content
            if 'headline' not in result:
                result['headline'] = self._get_highlight(result.get('content', ''), query)
        return results
    
    def _get_highlight(self, text: str, query: str, max_length: int = 200) -> str:
        """Get highlighted snippet from text."""
        words = query.split()
        if not words:
            return text[:max_length]
        
        # Find first occurrence of any word
        lower_text = text.lower()
        positions = []
        for word in words:
            pos = lower_text.find(word.lower())
            if pos != -1:
                positions.append(pos)
        
        if not positions:
            return text[:max_length] + "..."
        
        start = max(0, min(positions) - 50)
        end = min(len(text), start + max_length)
        
        snippet = text[start:end]
        if start > 0:
            snippet = "..." + snippet
        if end < len(text):
            snippet = snippet + "..."
        
        # Highlight words
        for word in words:
            snippet = snippet.replace(word, f"<mark>{word}</mark>")
            snippet = snippet.replace(word.capitalize(), f"<mark>{word.capitalize()}</mark>")
        
        return snippet
    
    def _serialize_results(self, queryset):
        """Serialize queryset results."""
        return [self._serialize_item(item) for item in queryset]
    
    def _serialize_item(self, item):
        """Serialize a single search result."""
        return {
            'id': str(item.id),
            'title': item.title,
            'description': item.description,
            'content_type': item.content_type,
            'content_id': item.content_id,
            'difficulty': item.difficulty,
            'tags': item.tags,
            'category': item.category,
            'popularity_score': item.popularity_score,
            'created_at': item.created_at.isoformat(),
            'headline': getattr(item, 'headline', item.description[:200]),
            'rank': getattr(item, 'rank', 0.0),
            'similarity': getattr(item, 'similarity', 0.0),
        }
    
    def _log_search_query(self, query, user, content_types, difficulty, tags, result_count, start_time):
        """Log search query for analytics."""
        response_time = int((time.time() - start_time) * 1000)
        
        SearchQuery.objects.create(
            user=user,
            query=query,
            content_types=content_types or [],
            difficulty=difficulty or '',
            tags=tags or [],
            result_count=result_count,
            response_time_ms=response_time
        )
    
    def _update_suggestions(self, query: str):
        """Update search suggestions."""
        suggestion, created = SearchSuggestion.objects.get_or_create(query=query)
        if not created:
            suggestion.increment_frequency()


class AutocompleteEngine:
    """
    Autocomplete engine for search suggestions.
    """
    
    def __init__(self):
        self.cache_ttl = 3600  # 1 hour
    
    def get_suggestions(self, prefix: str, limit: int = 10) -> List[str]:
        """Get autocomplete suggestions for a prefix."""
        if len(prefix) < 2:
            return []
        
        # Try cache first
        cache_key = f"autocomplete_{prefix}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached[:limit]
        
        # Query popular suggestions
        suggestions = SearchSuggestion.objects.filter(
            query__istartswith=prefix
        ).order_by('-frequency')[:limit]
        
        result = [s.query for s in suggestions]
        
        # Cache results
        cache.set(cache_key, result, self.cache_ttl)
        
        return result