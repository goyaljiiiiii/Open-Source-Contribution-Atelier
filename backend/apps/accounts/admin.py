from django.contrib import admin

from .models import MentorProfile


@admin.register(MentorProfile)
class MentorProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "get_assigned_lesson_count")
    search_fields = ("user__username", "user__email")
    filter_horizontal = ("assigned_lessons",)

    @admin.display(description="Assigned lessons")
    def get_assigned_lesson_count(self, obj: MentorProfile) -> int:
        return obj.assigned_lessons.count()
