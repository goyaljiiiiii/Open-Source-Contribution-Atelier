from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BadgeViewSet,
    MyAchievementsView,
    MyQuestsView,
    MyStreakView,
    MyXpView,
    PurchaseHistoryView,
    PurchaseItemView,
    ShopItemListView,
)
from .certificate_verification_view import (
    AntiCheatCheckView,
    CertificateVerificationView,
)

router = DefaultRouter()
router.register("badges", BadgeViewSet, basename="badge")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "verify-certificate/<str:hash>/",
        CertificateVerificationView.as_view(),
        name="verify-certificate",
    ),
    path(
        "anti-cheat/check/",
        AntiCheatCheckView.as_view(),
        name="anti-cheat-check",
    ),
    path("my-achievements/", MyAchievementsView.as_view(), name="my-achievements"),
    path("my-streak/", MyStreakView.as_view(), name="my-streak"),
    path("my-quests/", MyQuestsView.as_view(), name="my-quests"),
    path("my-xp/", MyXpView.as_view(), name="my-xp"),
    path("shop/", ShopItemListView.as_view(), name="shop-list"),
    path("shop/purchase/", PurchaseItemView.as_view(), name="shop-purchase"),
    path("shop/history/", PurchaseHistoryView.as_view(), name="shop-history"),
]
