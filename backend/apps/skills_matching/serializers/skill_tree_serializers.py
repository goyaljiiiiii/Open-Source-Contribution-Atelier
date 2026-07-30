from rest_framework import serializers

class SkillNodeSerializer(serializers.Serializer):
    id = serializers.CharField()
    title = serializers.CharField()
    domain = serializers.CharField()  # frontend, backend, devops, open_source, security
    category = serializers.CharField()
    description = serializers.CharField()
    prerequisites = serializers.ListField(child=serializers.CharField())
    status = serializers.CharField()  # locked, unlocked, in_progress, completed
    xp_reward = serializers.IntegerField()
    difficulty = serializers.CharField()
    position = serializers.DictField()  # {"x": int, "y": int}
    recommended_lessons = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    related_challenges = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    badge_reward = serializers.DictField(required=False, default=dict)
    progress_percent = serializers.IntegerField(default=0)


class SkillEdgeSerializer(serializers.Serializer):
    id = serializers.CharField()
    source = serializers.CharField()
    target = serializers.CharField()
    status = serializers.CharField()  # active, locked, completed


class SkillTreeOverviewSerializer(serializers.Serializer):
    user_xp = serializers.IntegerField()
    mastered_count = serializers.IntegerField()
    total_nodes = serializers.IntegerField()
    unlocked_count = serializers.IntegerField()
    current_track = serializers.CharField()
    tracks = serializers.ListField(child=serializers.DictField())
    nodes = SkillNodeSerializer(many=True)
    edges = SkillEdgeSerializer(many=True)


class CompleteNodeSerializer(serializers.Serializer):
    node_id = serializers.CharField(required=True)
