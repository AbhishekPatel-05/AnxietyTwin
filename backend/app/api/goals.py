"""
goals.py - API router for Feature 2: Personalized Wellness Goals & Care Plan
Endpoints:
- GET /api/goals: List goals with dynamic weekly progress
- POST /api/goals: Create goal
- GET /api/goals/suggestions: Suggest evidence-based goals based on user history
- GET /api/goals/weekly-summary: Weekly care plan view with planned vs completed
- PATCH /api/goals/{id}: Edit goal title, status (pause/resume/complete/archive), or target
- DELETE /api/goals/{id}: Delete goal
"""

from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.db_models import User, WellnessGoal
from backend.app.models.schemas import (
    WellnessGoalCreate,
    WellnessGoalUpdate,
    WellnessGoalOut,
    GoalSuggestionOut,
    WeeklyCarePlanSummaryOut,
)
from backend.app.api.deps import get_current_user
from backend.app.services.goal_service import (
    serialize_goal_with_progress,
    generate_goal_suggestions,
    get_weekly_care_plan_summary,
)

router = APIRouter(prefix="/goals", tags=["Wellness Goals & Care Plan"])


@router.get("", response_model=List[WellnessGoalOut])
def list_goals(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(WellnessGoal).filter(WellnessGoal.user_id == current_user.id)
    if status_filter:
        query = query.filter(WellnessGoal.status == status_filter)
    else:
        # Default: exclude archived
        query = query.filter(WellnessGoal.status != "archived")

    goals = query.order_by(WellnessGoal.created_at.desc()).all()
    return [serialize_goal_with_progress(g, db) for g in goals]


@router.post("", response_model=WellnessGoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    goal_in: WellnessGoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    new_goal = WellnessGoal(
        user_id=current_user.id,
        title=goal_in.title,
        description=goal_in.description,
        category=goal_in.category,
        target_frequency=goal_in.target_frequency,
        target_count=goal_in.target_count,
        start_date=goal_in.start_date or now.strftime("%Y-%m-%d"),
        end_date=goal_in.end_date,
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)
    return serialize_goal_with_progress(new_goal, db)


@router.get("/suggestions", response_model=List[GoalSuggestionOut])
def get_goal_suggestions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return generate_goal_suggestions(current_user.id, db)


@router.get("/weekly-summary", response_model=WeeklyCarePlanSummaryOut)
def get_weekly_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_weekly_care_plan_summary(current_user.id, db)


@router.patch("/{goal_id}", response_model=WellnessGoalOut)
def update_goal(
    goal_id: int,
    goal_update: WellnessGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = (
        db.query(WellnessGoal)
        .filter(WellnessGoal.id == goal_id, WellnessGoal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wellness goal not found.")

    if goal_update.title is not None:
        goal.title = goal_update.title
    if goal_update.description is not None:
        goal.description = goal_update.description
    if goal_update.category is not None:
        goal.category = goal_update.category
    if goal_update.target_frequency is not None:
        goal.target_frequency = goal_update.target_frequency
    if goal_update.target_count is not None:
        goal.target_count = goal_update.target_count
    if goal_update.status is not None:
        goal.status = goal_update.status
    if goal_update.end_date is not None:
        goal.end_date = goal_update.end_date

    goal.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(goal)
    return serialize_goal_with_progress(goal, db)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = (
        db.query(WellnessGoal)
        .filter(WellnessGoal.id == goal_id, WellnessGoal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wellness goal not found.")

    db.delete(goal)
    db.commit()
    return None
