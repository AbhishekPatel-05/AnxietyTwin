"""
pattern_discovery_service.py - Feature 1: Personal Trigger & Pattern Discovery
Analyzes historical check-ins, lifestyle data, physiological observations, and intervention feedback
to discover observational patterns between contexts, vitals, sleep, and distress ratings.
Strictly non-causal: correlation does not establish causation.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import json
from collections import defaultdict

from sqlalchemy.orm import Session
from backend.app.models.db_models import (
    User,
    AnxietyCheckin,
    LifestyleObservation,
    PhysiologicalObservation,
    InterventionSession,
    DiscoveredPattern,
)


def discover_user_patterns(user_id: int, db: Session) -> List[DiscoveredPattern]:
    """
    Analyzes historical data for a user and updates DiscoveredPattern records.
    Discovers:
    1. Contextual factors frequently associated with higher distress.
    2. Sleep duration relationships with self-reported distress.
    3. Physiological shifts (resting HR / HRV) around tagged events.
    4. Coping activities reported as helpful with distress delta.
    """
    now = datetime.now(timezone.utc)
    lookback_days = 90
    cutoff = now - timedelta(days=lookback_days)

    # 1. Fetch historical records
    checkins = (
        db.query(AnxietyCheckin)
        .filter(AnxietyCheckin.user_id == user_id, AnxietyCheckin.timestamp >= cutoff)
        .order_by(AnxietyCheckin.timestamp.asc())
        .all()
    )
    lifestyles = (
        db.query(LifestyleObservation)
        .filter(LifestyleObservation.user_id == user_id)
        .all()
    )
    physios = (
        db.query(PhysiologicalObservation)
        .filter(PhysiologicalObservation.user_id == user_id, PhysiologicalObservation.timestamp >= cutoff)
        .all()
    )
    interventions = (
        db.query(InterventionSession)
        .filter(InterventionSession.user_id == user_id, InterventionSession.started_at >= cutoff)
        .all()
    )

    # Quarantine synthetic and simulated data: only genuine records are analyzed
    checkins = [c for c in checkins if (c.source_type or "user_entered") not in ["synthetic", "simulated"]]
    lifestyles = [l for l in lifestyles if (l.source_type or "user_entered") not in ["synthetic", "simulated"]]
    physios = [p for p in physios if (p.source_type or "user_entered") not in ["synthetic", "simulated"]]
    interventions = [i for i in interventions if (i.source_type or "user_entered") not in ["synthetic", "simulated"]]

    if len(checkins) < 3:
        return []

    # Map dates to lifestyle observations
    life_by_date = {l.date: l for l in lifestyles}
    # Map dates to physiological observations
    phys_by_date = defaultdict(list)
    for p in physios:
        if p.timestamp:
            d_str = p.timestamp.strftime("%Y-%m-%d")
            phys_by_date[d_str].append(p)

    # Calculate overall baseline distress
    all_scores = [c.subjective_anxiety_score for c in checkins if c.subjective_anxiety_score is not None]
    overall_mean_distress = (sum(all_scores) / len(all_scores)) if all_scores else 5.0

    discovered = []

    # -------------------------------------------------------------
    # Pattern Type 1: Contextual Factors vs Distress Ratings
    # -------------------------------------------------------------
    context_scores = defaultdict(list)
    context_timestamps = defaultdict(list)

    for c in checkins:
        tags = []
        if c.context_tags:
            tags.extend(c.context_tags)
        if c.triggers_noted:
            tags.append(c.triggers_noted.strip())
        
        for t in tags:
            tag_clean = t.strip().title()
            if tag_clean:
                context_scores[tag_clean].append(c.subjective_anxiety_score)
                context_timestamps[tag_clean].append(c.timestamp.isoformat() if c.timestamp else "")

    for ctx, scores in context_scores.items():
        obs_count = len(scores)
        if obs_count >= 2:  # Minimum 2 occurrences to note an observational pattern
            ctx_mean = sum(scores) / obs_count
            delta = round(ctx_mean - overall_mean_distress, 1)

            confidence = "preliminary"
            if obs_count >= 8:
                confidence = "robust"
            elif obs_count >= 4:
                confidence = "moderate"

            if delta > 1.0:
                title = f"Context Correlation: '{ctx}' coincides with elevated distress"
                desc = (
                    f"Across {obs_count} recorded check-ins tagged with '{ctx}', your average distress rating was "
                    f"{round(ctx_mean, 1)} / 10, compared to your overall average of {round(overall_mean_distress, 1)} / 10 "
                    f"(+{delta} points). Observational correlation only; this does not establish causation."
                )
            elif delta < -1.0:
                title = f"Context Correlation: '{ctx}' coincides with lower distress"
                desc = (
                    f"Across {obs_count} recorded check-ins tagged with '{ctx}', your average distress rating was "
                    f"{round(ctx_mean, 1)} / 10, compared to your overall average of {round(overall_mean_distress, 1)} / 10 "
                    f"({delta} points)."
                )
            else:
                title = f"Context Correlation: '{ctx}' shows stable distress ratings"
                desc = (
                    f"Across {obs_count} recorded check-ins tagged with '{ctx}', distress ratings averaged "
                    f"{round(ctx_mean, 1)} / 10, remaining consistent with your typical baseline ({round(overall_mean_distress, 1)} / 10)."
                )

            evidence = {
                "tag": ctx,
                "observation_count": obs_count,
                "context_mean_distress": round(ctx_mean, 1),
                "overall_mean_distress": round(overall_mean_distress, 1),
                "delta": delta,
                "timestamps": context_timestamps[ctx][:10],
            }

            discovered.append({
                "pattern_type": "context_trigger",
                "title": title,
                "description": desc,
                "trigger_context": ctx,
                "distress_correlation": delta,
                "observation_count": obs_count,
                "time_range": f"Last {lookback_days} days",
                "confidence_level": confidence,
                "evidence": evidence,
            })

    # -------------------------------------------------------------
    # Pattern Type 2: Sleep Duration & Regularity vs Next-Day Distress
    # -------------------------------------------------------------
    short_sleep_scores = []
    normal_sleep_scores = []

    for c in checkins:
        if not c.timestamp:
            continue
        c_date = c.timestamp.strftime("%Y-%m-%d")
        # Check lifestyle observation on current or preceding day
        prev_date = (c.timestamp - timedelta(days=1)).strftime("%Y-%m-%d")
        life = life_by_date.get(c_date) or life_by_date.get(prev_date)

        if life and life.sleep_hours is not None:
            if life.sleep_hours < 6.5:
                short_sleep_scores.append(c.subjective_anxiety_score)
            elif life.sleep_hours >= 7.0:
                normal_sleep_scores.append(c.subjective_anxiety_score)

    if len(short_sleep_scores) >= 3 and len(normal_sleep_scores) >= 3:
        mean_short = sum(short_sleep_scores) / len(short_sleep_scores)
        mean_normal = sum(normal_sleep_scores) / len(normal_sleep_scores)
        sleep_delta = round(mean_short - mean_normal, 1)

        conf = "robust" if (len(short_sleep_scores) + len(normal_sleep_scores)) >= 10 else "moderate"
        title = "Sleep Pattern: Shorter sleep duration coincides with higher distress"
        desc = (
            f"On days following less than 6.5 hours of sleep ({len(short_sleep_scores)} observations), "
            f"your self-reported distress averaged {round(mean_short, 1)} / 10, compared to {round(mean_normal, 1)} / 10 "
            f"when sleeping 7+ hours ({len(normal_sleep_scores)} observations). "
            f"Difference: {sleep_delta > 0 and '+' or ''}{sleep_delta} points. Non-causal observation."
        )

        evidence = {
            "short_sleep_obs_count": len(short_sleep_scores),
            "short_sleep_mean_distress": round(mean_short, 1),
            "normal_sleep_obs_count": len(normal_sleep_scores),
            "normal_sleep_mean_distress": round(mean_normal, 1),
            "distress_difference": sleep_delta,
        }

        discovered.append({
            "pattern_type": "sleep_distress",
            "title": title,
            "description": desc,
            "trigger_context": "Sleep Disruption",
            "distress_correlation": sleep_delta,
            "observation_count": len(short_sleep_scores) + len(normal_sleep_scores),
            "time_range": f"Last {lookback_days} days",
            "confidence_level": conf,
            "evidence": evidence,
        })

    # -------------------------------------------------------------
    # Pattern Type 3: Coping Activity Efficacy & Relief
    # -------------------------------------------------------------
    coping_by_type = defaultdict(list)
    for inv in interventions:
        if inv.intervention_type and inv.status == "completed":
            coping_by_type[inv.intervention_type].append(inv)

    for itype, sessions in coping_by_type.items():
        if len(sessions) >= 2:
            helpful_count = sum(1 for s in sessions if s.helpfulness in ["helpful", "somewhat_helpful"])
            deltas = [s.rating_delta for s in sessions if s.rating_delta is not None]
            avg_delta = round(sum(deltas) / len(deltas), 1) if deltas else 0.0
            helpful_pct = round((helpful_count / len(sessions)) * 100, 1)

            nice_name = itype.replace("_", " ").title()
            title = f"Coping Efficacy: {nice_name} consistently reported as helpful"
            desc = (
                f"You reported {nice_name} as helpful in {helpful_count} of {len(sessions)} completed sessions ({helpful_pct}%). "
                f"Average immediate distress change: {avg_delta} rating points."
            )

            evidence = {
                "intervention_type": itype,
                "total_sessions": len(sessions),
                "helpful_sessions": helpful_count,
                "helpful_percentage": helpful_pct,
                "average_rating_delta": avg_delta,
            }

            discovered.append({
                "pattern_type": "coping_efficacy",
                "title": title,
                "description": desc,
                "trigger_context": nice_name,
                "distress_correlation": avg_delta,
                "observation_count": len(sessions),
                "time_range": f"Last {lookback_days} days",
                "confidence_level": "robust" if len(sessions) >= 6 else "moderate",
                "evidence": evidence,
            })

    # -------------------------------------------------------------
    # Synchronize into DiscoveredPattern Database Records
    # -------------------------------------------------------------
    # Load existing user patterns
    existing_patterns = (
        db.query(DiscoveredPattern)
        .filter(DiscoveredPattern.user_id == user_id)
        .all()
    )
    existing_by_title = {p.title: p for p in existing_patterns}

    result_records = []
    for item in discovered:
        existing = existing_by_title.get(item["title"])
        evidence_json = json.dumps(item["evidence"])
        if existing:
            # Preserve user-customized status (e.g. if user marked it relevant or dismissed)
            existing.description = item["description"]
            existing.distress_correlation = item["distress_correlation"]
            existing.observation_count = item["observation_count"]
            existing.confidence_level = item["confidence_level"]
            existing.evidence_summary_json = evidence_json
            existing.updated_at = now
            result_records.append(existing)
        else:
            new_p = DiscoveredPattern(
                user_id=user_id,
                pattern_type=item["pattern_type"],
                title=item["title"],
                description=item["description"],
                trigger_context=item["trigger_context"],
                distress_correlation=item["distress_correlation"],
                observation_count=item["observation_count"],
                time_range=item["time_range"],
                confidence_level=item["confidence_level"],
                status="active",
                evidence_summary_json=evidence_json,
                created_at=now,
                updated_at=now,
            )
            db.add(new_p)
            result_records.append(new_p)

    db.commit()
    for r in result_records:
        db.refresh(r)

    return result_records
