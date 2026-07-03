"""
Admin configuration for search app.
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import SearchableContent, SearchQuery, SearchAnalytics, SearchSuggestion


@admin.register(SearchableContent)
class SearchableContentAdmin(admin.ModelAdmin):
    """
    Admin for SearchableContent model.
    """
    
    list_display = ['title', 'content_type', 'content_id', 'difficulty', 'popularity_score']
    list_filter = ['content_type', 'difficulty', 'language']
    search_fields = ['title', 'description', 'content']
    readonly_fields = ['search_vector', 'embedding', 'popularity_score']
    
    fieldsets = (
        ('Content', {
            'fields': ('content_type', 'content_id', 'title', 'description', 'content')
        }),
        ('Metadata', {
            'fields': ('difficulty', 'category', 'author', 'language', 'tags')
        }),
        ('Search Data', {
            'fields': ('search_vector', 'embedding', 'popularity_score', 'engagement_score')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(SearchQuery)
class SearchQueryAdmin(admin.ModelAdmin):
    """
    Admin for SearchQuery model.
    """
    
    list_display = ['query', 'user', 'result_count', 'response_time_ms', 'created_at']
    list_filter = ['query_type', 'difficulty', 'created_at']
    search_fields = ['query']
    readonly_fields = ['id', 'created_at']
    
    def has_add_permission(self, request):
        return False


@admin.register(SearchSuggestion)
class SearchSuggestionAdmin(admin.ModelAdmin):
    """
    Admin for SearchSuggestion model.
    """
    
    list_display = ['query', 'frequency', 'last_searched']
    search_fields = ['query']
    readonly_fields = ['frequency', 'last_searched']


@admin.register(SearchAnalytics)
class SearchAnalyticsAdmin(admin.ModelAdmin):
    """
    Admin for SearchAnalytics model.
    """
    
    list_display = ['date', 'total_searches', 'unique_users', 'zero_result_searches', 'avg_response_time']
    readonly_fields = ['date', 'total_searches', 'unique_users', 'zero_result_searches', 
                       'avg_response_time', 'top_queries', 'top_content_types', 'popular_tags']
    
    def has_add_permission(self, request):
        return False