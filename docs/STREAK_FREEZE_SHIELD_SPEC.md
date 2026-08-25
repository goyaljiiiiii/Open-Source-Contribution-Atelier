# Streak Freeze Shield Shop Inventory & Engine Specification

## 1. Context and Problem
Consistent contribution streaks are a core gamification pillar encouraging daily open source engagement. However, unexpected life events or travel can cause contributors to break a multi-week streak unexpectedly.
To provide agency and resilience, the Rewards Shop offers the **Streak Freeze Shield** ("Flame Saver") item, enabling contributors to exchange accumulated learning XP for streak protection shields.

## 2. Architecture & Business Logic
1. **Shop Inventory Catalog**:
   - Item Name: `Flame Saver (Streak Freeze)`
   - Item Type: `streak_freeze`
   - Cost: `150 XP`
   - Benefit: `1 Day Streak Shield`
   - Unlock Level: `Level 1`
2. **Purchase Workflow (`apps/gamification/views.py`)**:
   - Validates user XP balance using atomic database row locks (`select_for_update()`).
   - Deducts 150 XP from user ledger via `XPEvent.objects.create(xp_delta=-150, source_type='shop')`.
   - Records the receipt in `Purchase.objects.create()`.
   - Increments the user's `StreakProfile.streak_freezes` balance.
3. **Streak Engine Consumption (`apps/progress/streak_engine.py`)**:
   - When a user logs activity after a 1-day or multi-day gap:
     ```python
     missed_days = (activity_date - last).days - 1
     if profile.streak_freezes >= missed_days:
         profile.streak_freezes -= missed_days
         profile.current_streak += 1
     else:
         profile.current_streak = 1
     ```
   - Automatically consumes active shields to preserve the user's continuous streak and associated XP multipliers.

## 3. Reference Implementation
```python
# In apps/gamification/views.py (PurchaseItemView):
if item.item_type == "streak_freeze":
    from apps.progress.models import StreakProfile
    streak_profile, _ = StreakProfile.objects.get_or_create(user=request.user)
    streak_profile.streak_freezes += 1
    streak_profile.save(update_fields=["streak_freezes"])
```

## 4. Item Comparison & Mechanics
| Shop Item | Type | Cost (XP) | Max Owned | Engine Effect |
| --- | --- | --- | --- | --- |
| Flame Saver | `streak_freeze` | 150 XP | Unlimited | Consumed automatically on 1-day inactivity gap |
| 2x XP Multiplier Boost | `xp_boost` | 300 XP | 1 per day | Doubles XP delta for 24 hours |
| Cyberpunk UI Theme | `profile_theme` | 500 XP | 1 (Limited) | Unlocks theme selector options |
| Diamond Badge | `badge_unlock` | 750 XP | 1 (Limited) | Awards profile achievement badge |

## 5. Verification Checklist
- [x] Backend unit test suite in `backend/apps/gamification/tests/test_streak_freeze_purchase.py` validates:
  - Purchase atomic deduction and `StreakProfile.streak_freezes` increment.
  - Multi-purchase accumulation.
  - Automatic streak preservation on 1-day gap.
  - Streak reset fallback when freeze count is 0.
  - Insufficient XP rejection.
- [x] Frontend test suite in `frontend/src/test/StreakFreezeShop.test.tsx` validates:
  - Catalog rendering of Flame Saver with flame emoji and shield description.
  - Purchase button interaction with optimistic XP balance update.
  - Category tab filtering.
