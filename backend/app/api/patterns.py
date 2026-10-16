"""
patterns.py - API router for Feature 1: Personal Trigger & Pattern Discovery
Endpoints:
- GET /api/patterns: List discovered patterns (with status filter)
- POST /api/patterns/discover: Trigger discovery analysis
- PATCH /api/patterns/{id}/feedback: Mark relevant, irrelevant, dismissed, or active
- GET /api/patterns/summary: Summary trends and frequency breakdown
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.db_models import User, DiscoveredPattern, AnxietyCheckin, LifestyleObservation
from backend.app.models.schemas import (
    DiscoveredPatternOut,
    PatternFeedbackUpdate,
    PatternAnalysisResponse,
)
from backend.app.api.deps import get_current_user
from backend.app.services.pattern_discovery_service import discover_user_patterns

router = APIRouter(prefix="/patterns", tags=["Trigger & Pattern Discovery"])


@router.get("", response_model=List[DiscoveredPatternOut])
def list_user_patterns(
    status_filter: Optional[str] = Query(None, description="active, relevant, irrelevant, dismissed"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns patterns discovered for the authenticated user.
    If no patterns have been calculated yet, automatically triggers initial analysis.
    """
    query = db.query(DiscoveredPattern).filter(DiscoveredPattern.user_id == current_user.id)
    if status_filter:
        query = query.filter(DiscoveredPattern.status == status_filter)
    else:
        # Default: exclude dismissed
        query = query.filter(DiscoveredPattern.status != "dismissed")

    patterns = query.order_by(DiscoveredPattern.observation_count.desc()).all()
    if not patterns:
        # Auto-discover if checkins exist
        patterns = discover_user_patterns(current_user.id, db)
        if status_filter:
            patterns = [p for p in patterns if p.status == status_filter]
        else:
            patterns = [p for p in patterns if p.status != "dismissed"]

    return patterns


@router.post("/discover", response_model=PatternAnalysisResponse)
def trigger_pattern_discovery(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Runs pattern discovery across all historical observations and returns discovered patterns with evidence.
    """
    patterns = discover_user_patterns(current_user.id, db)

    checkin_count = (
        db.query(AnxietyCheckin)
        .filter(
            AnxietyCheckin.user_id == current_user.id,
            (AnxietyCheckin.source_type == None) | (~AnxietyCheckin.source_type.in_(["synthetic", "simulated"])),
        )
        .count()
    )
    life_days = (
        db.query(LifestyleObservation)
        .filter(
            LifestyleObservation.user_id == current_user.id,
            (LifestyleObservation.source_type == None) | (~LifestyleObservation.source_type.in_(["synthetic", "simulated"])),
        )
        .count()
    )

    insufficient = checkin_count < 3

    return PatternAnalysisResponse(
        patterns=patterns,
        analyzed_checkin_count=checkin_count,
        analyzed_observation_days=life_days,
        insufficient_data=insufficient,
        disclaimer=(
            "Discovered patterns represent statistical associations in historical self-reports and observations. "
            "Correlation does not imply causation. They do NOT establish clinical causation, nor do they claim any context causes panic or anxiety."
        ),
    )


@router.patch("/{pattern_id}/feedback", response_model=DiscoveredPatternOut)
def update_pattern_feedback(
    pattern_id: int,
    feedback: PatternFeedbackUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Allows user to mark a discovered pattern as relevant, irrelevant, dismissed, or active.
    """
    valid_statuses = ["active", "relevant", "irrelevant", "dismissed"]
    if feedback.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{feedback.status}'. Must be one of {valid_statuses}",
        )

    pattern = (
        db.query(DiscoveredPattern)
        .filter(DiscoveredPattern.id == pattern_id, DiscoveredPattern.user_id == current_user.id)
        .first()
    )
    if not pattern:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pattern record not found.")

    pattern.status = feedback.status
    db.commit()
    db.refresh(pattern)
    return pattern


@router.get("/summary")
def get_pattern_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns weekly/monthly trend aggregations and context heatmap matrices.
    """
    checkins = (
        db.query(AnxietyCheckin)
        .filter(AnxietyCheckin.user_id == current_user.id)
        .order_by(AnxietyCheckin.timestamp.asc())
        .all()
    )

    context_counts = {}
    day_counts = {}

    for c in checkins:
        if c.timestamp:
            d_str = c.timestamp.strftime("%Y-%m-%d")
            day_counts[d_str] = day_counts.get(d_str, 0) + 1
        tags = []
        if c.context_tags:
            tags.extend(c.context_tags)
        if c.triggers_noted:
            tags.append(c.triggers_noted.strip().title())

        for t in tags:
            tag_name = t.strip().title()
            if tag_name:
                context_counts[tag_name] = context_counts.get(tag_name, 0) + 1

    return {
        "total_checkins": len(checkins),
        "distinct_days_recorded": len(day_counts),
        "top_context_factors": sorted(
            [{"factor": k, "count": v} for k, v in context_counts.items()],
            key=lambda x: x["count"],
            reverse=True,
        ),
        "calendar_heatmap": [{"date": k, "count": v} for k, v in sorted(day_counts.items())[-30:]],
        "disclaimer": "Observational context summaries. Does not infer medical causation.",
    }
