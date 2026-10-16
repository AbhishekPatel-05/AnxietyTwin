"""
goal_service.py - Feature 2: Personalized Wellness Goals & Care Plan Service
Manages user-controlled wellness goals, calculates weekly progress from existing records
(without duplicating activity tracking), and provides evidence-informed goal suggestions.
Voluntary, non-judgmental, non-prescriptive.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session
from backend.app.models.db_models import (
    User,
    WellnessGoal,
    AnxietyCheckin,
    PhysiologicalObservation,
    LifestyleObservation,
    InterventionSession,
    EmotionJournalEntry,
)
from backend.app.models.schemas import (
    WellnessGoalOut,
    GoalSuggestionOut,
    WeeklyCarePlanSummaryOut,
)


def get_current_week_bounds():
    """Returns (start_of_week_dt, end_of_week_dt, start_str, end_str) for current Monday-Sunday UTC."""
    now = datetime.now(timezone.utc)
    monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    sunday = monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return monday, sunday, monday.strftime("%Y-%m-%d"), sunday.strftime("%Y-%m-%d")


def calculate_goal_progress(goal: WellnessGoal, db: Session) -> Dict[str, Any]:
    """
    Computes completed count for the current calendar week dynamically
    from genuine user activity records.
    """
    start_dt, end_dt, start_str, end_str = get_current_week_bounds()

    completed = 0
    cat = (goal.category or "").lower()

    if cat == "checkin":
        all_c = db.query(AnxietyCheckin).filter(AnxietyCheckin.user_id == goal.user_id).all()
        completed = sum(1 for c in all_c if c.timestamp and start_str <= c.timestamp.strftime("%Y-%m-%d") <= end_str)
    elif cat == "sleep_routine":
        all_l = db.query(LifestyleObservation).filter(LifestyleObservation.user_id == goal.user_id).all()
        completed = sum(1 for l in all_l if l.date and start_str <= l.date <= end_str and (l.sleep_hours or 0) >= 7.0)
    elif cat in ["breathing", "grounding"]:
        inv_type = "breathing_478" if cat == "breathing" else "grounding_54321"
        all_s = db.query(InterventionSession).filter(
            InterventionSession.user_id == goal.user_id,
            InterventionSession.intervention_type == inv_type,
            InterventionSession.status == "completed",
        ).all()
        completed = sum(1 for s in all_s if s.started_at and start_str <= s.started_at.strftime("%Y-%m-%d") <= end_str)
    elif cat == "journaling":
        all_j = db.query(EmotionJournalEntry).filter(EmotionJournalEntry.user_id == goal.user_id).all()
        completed = sum(1 for j in all_j if j.created_at and start_str <= j.created_at.strftime("%Y-%m-%d") <= end_str)
    elif cat == "physical_activity":
        # Check active days from either lifestyle exercise minutes or physiological steps count
        exercise_days = {
            l.date for l in db.query(LifestyleObservation).filter(
                LifestyleObservation.user_id == goal.user_id,
                LifestyleObservation.date >= start_str,
                LifestyleObservation.date <= end_str,
                LifestyleObservation.exercise_minutes >= 15,
            ).all() if l.date
        }
        step_days = {
            p.timestamp.strftime("%Y-%m-%d") for p in db.query(PhysiologicalObservation).filter(
                PhysiologicalObservation.user_id == goal.user_id,
                PhysiologicalObservation.timestamp >= start_dt,
                PhysiologicalObservation.timestamp <= end_dt,
                PhysiologicalObservation.steps_count >= 4000,
            ).all() if p.timestamp
        }
        completed = len(exercise_days.union(step_days))
    else:
        # Generic intervention or checkin count fallback
        completed = (
            db.query(InterventionSession)
            .filter(
                InterventionSession.user_id == goal.user_id,
                InterventionSession.status == "completed",
                InterventionSession.started_at >= start_dt,
                InterventionSession.started_at <= end_dt,
            )
            .count()
        )

    target = goal.target_count or 5
    on_track = completed >= target or (completed >= (datetime.now(timezone.utc).weekday() + 1) * (target / 7.0))

    return {
        "progress": completed,
        "target": target,
        "is_on_track": on_track,
    }


def serialize_goal_with_progress(goal: WellnessGoal, db: Session) -> WellnessGoalOut:
    prog = calculate_goal_progress(goal, db)
    return WellnessGoalOut(
        id=goal.id,
        user_id=goal.user_id,
        title=goal.title,
        description=goal.description,
        category=goal.category,
        target_frequency=goal.target_frequency,
        target_count=goal.target_count,
        start_date=goal.start_date,
        end_date=goal.end_date,
        status=goal.status,
        current_week_progress=prog["progress"],
        current_week_target=prog["target"],
        is_on_track=prog["is_on_track"],
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


def generate_goal_suggestions(user_id: int, db: Session) -> List[GoalSuggestionOut]:
    """Generates optional personalized suggestions based on recent user observations."""
    recent_checkins = (
        db.query(AnxietyCheckin)
        .filter(AnxietyCheckin.user_id == user_id)
        .order_by(AnxietyCheckin.timestamp.desc())
        .limit(10)
        .all()
    )
    recent_lifestyles = (
        db.query(LifestyleObservation)
        .filter(LifestyleObservation.user_id == user_id)
        .order_by(LifestyleObservation.date.desc())
        .limit(7)
        .all()
    )

    avg_distress = (
        sum(c.subjective_anxiety_score for c in recent_checkins) / len(recent_checkins)
        if recent_checkins
        else 4.0
    )
    avg_sleep = (
        sum(l.sleep_hours for l in recent_lifestyles) / len(recent_lifestyles)
        if recent_lifestyles
        else 7.0
    )

    suggestions = []

    # 1. Check-in habit
    if len(recent_checkins) < 5:
        suggestions.append(
            GoalSuggestionOut(
                title="Consistent Morning Check-in",
                description="Take 60 seconds each morning to record your distress, vitals, and context.",
                category="checkin",
                target_frequency="daily",
                target_count=5,
                rationale="Calibrates your baseline data and helps identify subtle physiological shifts early.",
            )
        )

    # 2. Sleep Routine
    if avg_sleep < 6.8:
        suggestions.append(
            GoalSuggestionOut(
                title="7-Hour Sleep Routine Window",
                description="Protect a regular wind-down window targeting at least 7 hours of restorative sleep.",
                category="sleep_routine",
                target_frequency="daily",
                target_count=5,
                rationale="Observations indicate shorter sleep frequently coincides with elevated autonomic arousal.",
            )
        )

    # 3. 4-7-8 Breathing
    if avg_distress >= 4.0:
        suggestions.append(
            GoalSuggestionOut(
                title="Daily 4-7-8 Parasympathetic Breathing",
                description="Complete 4 cycles of paced 4-7-8 breathwork when experiencing stress or at bedtime.",
                category="breathing",
                target_frequency="daily",
                target_count=4,
                rationale="Evidence-based breathing exercises activate vagal tone and downregulate sympathetic surges.",
            )
        )

    # 4. 5-4-3-2-1 Grounding
    suggestions.append(
        GoalSuggestionOut(
            title="Sensory Grounding (5-4-3-2-1) Practice",
            description="Engage sensory awareness to stay centered during overwhelming or fast-paced days.",
            category="grounding",
            target_frequency="3_times_week",
            target_count=3,
            rationale="Sensory grounding interrupts cognitive spirals and reorients attention to the present moment.",
        )
    )

    # 5. Journaling
    suggestions.append(
        GoalSuggestionOut(
            title="Reflective Emotion Journaling",
            description="Write a brief entry exploring thoughts, triggers, and what helped cope.",
            category="journaling",
            target_frequency="3_times_week",
            target_count=3,
            rationale="Captures qualitative nuance that wearables and telemetry cannot observe.",
        )
    )

    return suggestions


def get_weekly_care_plan_summary(user_id: int, db: Session) -> WeeklyCarePlanSummaryOut:
    """Provides a compassionate, non-punitive weekly progress summary."""
    start_dt, end_dt, start_str, end_str = get_current_week_bounds()

    active_goals = (
        db.query(WellnessGoal)
        .filter(WellnessGoal.user_id == user_id, WellnessGoal.status == "active")
        .all()
    )

    serialized_goals = [serialize_goal_with_progress(g, db) for g in active_goals]

    total_completed = sum(g.current_week_progress for g in serialized_goals)
    total_planned = sum(g.current_week_target for g in serialized_goals)
    rate = round((total_completed / total_planned * 100), 1) if total_planned > 0 else 0.0

    # User-reported helpfulness breakdown from completed sessions this week
    sessions = (
        db.query(InterventionSession)
        .filter(
            InterventionSession.user_id == user_id,
            InterventionSession.started_at >= start_dt,
            InterventionSession.started_at <= end_dt,
        )
        .all()
    )
    helpfulness_summary = {"helpful": 0, "somewhat_helpful": 0, "not_helpful": 0}
    for s in sessions:
        if s.helpfulness in helpfulness_summary:
            helpfulness_summary[s.helpfulness] += 1

    msg = (
        f"You have engaged in {total_completed} wellness activities this week. "
        "Every mindful moment and check-in supports your self-awareness."
        if total_completed > 0
        else "No activities recorded yet this week. Remember that goals are voluntary tools to support you at your own pace."
    )

    return WeeklyCarePlanSummaryOut(
        week_start=start_str,
        week_end=end_str,
        planned_goals_count=len(active_goals),
        active_goals=serialized_goals,
        total_completed_activities=total_completed,
        total_planned_activities=total_planned,
        completion_rate_pct=rate,
        user_helpfulness_summary=helpfulness_summary,
        supportive_message=msg,
        disclaimer="Voluntary wellness goals. Not a clinician-prescribed medical treatment plan.",
    )
