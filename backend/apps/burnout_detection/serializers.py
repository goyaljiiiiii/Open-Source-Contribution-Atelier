from rest_framework import serializers

from .models import BurnoutMetric, BurnoutSignal, ContributorActivity, Intervention


class ContributorActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ContributorActivity
        fields = "__all__"


class BurnoutSignalSerializer(serializers.ModelSerializer):
    class Meta:
        model = BurnoutSignal
        fields = "__all__"


class InterventionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Intervention
        fields = "__all__"


class BurnoutMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = BurnoutMetric
        fields = "__all__"


class WeeklyBurnoutTrendDataPointSerializer(serializers.Serializer):
    week_start = serializers.DateField()
    week_end = serializers.DateField()
    week_number = serializers.IntegerField()
    total_active_hours = serializers.FloatField()
    average_daily_hours = serializers.FloatField()
    active_days_count = serializers.IntegerField()
    burnout_score = serializers.FloatField()
    burnout_risk = serializers.CharField()
    signals_count = serializers.IntegerField()
    trend_direction = serializers.CharField()


class UserWeeklyBurnoutTrendsResponseSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    weeks_analyzed = serializers.IntegerField()
    current_score = serializers.FloatField()
    current_risk = serializers.CharField()
    overall_trend = serializers.CharField()
    weekly_trends = WeeklyBurnoutTrendDataPointSerializer(many=True)
