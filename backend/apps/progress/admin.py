from django.contrib import admin

from .models import Badge, ExerciseAttempt, LessonProgress


admin.site.register(Badge)
admin.site.register(LessonProgress)
admin.site.register(ExerciseAttempt)

