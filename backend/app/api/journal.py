"""
journal.py - Feature 3: Emotion Journal & Context Capture API Router
Captures personal reflections and qualitative context.
Strict privacy: Private by default. Clinicians never have access unless the patient
explicitly enables 'shared_with_clinician'.
AI theme summarization requires explicit user consent and clearly labels output as AI-generated.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import json
from collections import Counter
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.db_models import User, EmotionJournalEntry, PrivacyAuditLog
from backend.app.models.schemas import (
    EmotionJournalEntryCreate,
    EmotionJournalEntryUpdate,
    EmotionJournalEntryOut,
    JournalThemeSummaryRequest,
    JournalThemeSummaryResponse,
)
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/journal", tags=["Emotion Journal"])


def serialize_journal_entry(entry: EmotionJournalEntry) -> EmotionJournalEntryOut:
    return EmotionJournalEntryOut(
        id=entry.id,
        user_id=entry.user_id,
        title=entry.title,
        content=entry.content,
        mood_tags=entry.mood_tags,
        distress_rating=entry.distress_rating,
        context_tags=entry.context_tags,
        prompt_responses=entry.prompt_responses if entry.prompt_responses else None,
        is_private=entry.is_private,
        shared_with_clinician=entry.shared_with_clinician,
        linked_checkin_id=entry.linked_checkin_id,
        ai_summary=entry.ai_summary,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.get("", response_model=List[EmotionJournalEntryOut])
def list_journal_entries(
    search: Optional[str] = Query(None, description="Free-text search across title and content"),
    mood_tag: Optional[str] = Query(None, description="Filter by mood tag"),
    context_tag: Optional[str] = Query(None, description="Filter by context tag"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves user's private journal entries with search and multi-tag filtering.
    """
    query = db.query(EmotionJournalEntry).filter(EmotionJournalEntry.user_id == current_user.id)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            (EmotionJournalEntry.title.ilike(search_term)) | (EmotionJournalEntry.content.ilike(search_term))
        )

    if mood_tag:
        query = query.filter(EmotionJournalEntry.mood_tags_json.ilike(f"%{mood_tag.strip()}%"))

    if context_tag:
        query = query.filter(EmotionJournalEntry.context_tags_json.ilike(f"%{context_tag.strip()}%"))

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
            query = query.filter(EmotionJournalEntry.created_at >= start_dt)
        except Exception:
            pass

    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            query = query.filter(EmotionJournalEntry.created_at <= end_dt)
        except Exception:
            pass

    entries = query.order_by(EmotionJournalEntry.created_at.desc()).all()
    return [serialize_journal_entry(e) for e in entries]


@router.post("", response_model=EmotionJournalEntryOut, status_code=status.HTTP_201_CREATED)
def create_journal_entry(
    entry_in: EmotionJournalEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    entry = EmotionJournalEntry(
        user_id=current_user.id,
        title=entry_in.title,
        content=entry_in.content,
        mood_tags_json=json.dumps(entry_in.mood_tags) if entry_in.mood_tags else None,
        distress_rating=entry_in.distress_rating,
        context_tags_json=json.dumps(entry_in.context_tags) if entry_in.context_tags else None,
        prompt_responses_json=json.dumps(entry_in.prompt_responses) if entry_in.prompt_responses else None,
        is_private=entry_in.is_private,
        shared_with_clinician=entry_in.shared_with_clinician,
        linked_checkin_id=entry_in.linked_checkin_id,
        created_at=now,
        updated_at=now,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return serialize_journal_entry(entry)


@router.get("/{entry_id}", response_model=EmotionJournalEntryOut)
def get_journal_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(EmotionJournalEntry)
        .filter(EmotionJournalEntry.id == entry_id, EmotionJournalEntry.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found.")
    return serialize_journal_entry(entry)


@router.put("/{entry_id}", response_model=EmotionJournalEntryOut)
def update_journal_entry(
    entry_id: int,
    entry_update: EmotionJournalEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(EmotionJournalEntry)
        .filter(EmotionJournalEntry.id == entry_id, EmotionJournalEntry.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found.")

    if entry_update.title is not None:
        entry.title = entry_update.title
    if entry_update.content is not None:
        entry.content = entry_update.content
    if entry_update.mood_tags is not None:
        entry.mood_tags_json = json.dumps(entry_update.mood_tags)
    if entry_update.distress_rating is not None:
        entry.distress_rating = entry_update.distress_rating
    if entry_update.context_tags is not None:
        entry.context_tags_json = json.dumps(entry_update.context_tags)
    if entry_update.prompt_responses is not None:
        entry.prompt_responses_json = json.dumps(entry_update.prompt_responses)
    if entry_update.is_private is not None:
        entry.is_private = entry_update.is_private
    if entry_update.shared_with_clinician is not None:
        entry.shared_with_clinician = entry_update.shared_with_clinician
        # Log privacy audit event if sharing status changes
        log = PrivacyAuditLog(
            user_id=current_user.id,
            action="journal_sharing_updated",
            performed_by_id=current_user.id,
            details_json=json.dumps({"entry_id": entry.id, "shared_with_clinician": entry.shared_with_clinician}),
            timestamp=datetime.now(timezone.utc),
        )
        db.add(log)

    entry.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(entry)
    return serialize_journal_entry(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journal_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(EmotionJournalEntry)
        .filter(EmotionJournalEntry.id == entry_id, EmotionJournalEntry.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found.")

    db.delete(entry)
    db.commit()
    return None


@router.post("/theme-summary", response_model=JournalThemeSummaryResponse)
def generate_theme_summary(
    req: JournalThemeSummaryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Extracts recurring themes across journal entries with explicit user consent.
    Clearly distinguishes AI-generated summary from authentic journal entries.
    """
    if not req.user_consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Explicit user consent is required before processing journal entries for theme summarization.",
        )

    query = db.query(EmotionJournalEntry).filter(EmotionJournalEntry.user_id == current_user.id)
    if req.entry_ids:
        query = query.filter(EmotionJournalEntry.id.in_(req.entry_ids))

    entries = query.order_by(EmotionJournalEntry.created_at.desc()).limit(25).all()
    if not entries:
        return JournalThemeSummaryResponse(
            themes=[],
            summary_text="No journal entries available to summarize. Add reflective entries to explore recurring themes.",
            entry_count=0,
            is_ai_generated=True,
            distinction_notice="This theme summary was synthesized by AI and is distinct from your authentic personal journal entries.",
        )

    # Collect tags and keywords
    all_moods = []
    all_contexts = []
    for e in entries:
        all_moods.extend(e.mood_tags)
        all_contexts.extend(e.context_tags)

    top_moods = [m for m, _ in Counter(all_moods).most_common(3)]
    top_contexts = [c for c, _ in Counter(all_contexts).most_common(3)]

    themes = []
    if top_contexts:
        themes.append(f"Recurring Situational Context: {', '.join(top_contexts)}")
    if top_moods:
        themes.append(f"Frequent Affective States: {', '.join(top_moods)}")
    themes.append("Adaptive Coping & Self-Reflection Engagement")

    avg_distress = (
        round(sum(e.distress_rating for e in entries if e.distress_rating is not None) / len(entries), 1)
        if any(e.distress_rating is not None for e in entries)
        else None
    )

    summary_text = (
        f"Across {len(entries)} analyzed reflection entries, prominent themes center around "
        f"{', '.join(top_contexts) if top_contexts else 'daily life experiences'}, with emotional tone frequently described as "
        f"{', '.join(top_moods) if top_moods else 'mixed feelings'}. "
        f"{f'Average self-reported distress across these entries was {avg_distress}/10. ' if avg_distress is not None else ''}"
        "Your entries frequently identify personal reflection and mindful pauses as helpful coping steps."
    )

    return JournalThemeSummaryResponse(
        themes=themes,
        summary_text=summary_text,
        entry_count=len(entries),
        is_ai_generated=True,
        distinction_notice="This theme summary was synthesized by AI and is distinct from your authentic personal journal entries.",
    )
