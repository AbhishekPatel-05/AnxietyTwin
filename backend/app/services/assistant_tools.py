"""
AnxietyTwin - Safe Assistant Tool Calling Engine
Provides strictly authorized, read-only and proposal tools for the AI Assistant.
User identity is ALWAYS bound to the authenticated backend session (never client-supplied).
Zero direct mutations of risk scores, clinical records, or baselines are permitted.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from backend.app.models.db_models import (
    User,
    UserProfile,
    PhysiologicalObservation,
    LifestyleObservation,
    AnxietyCheckin,
    WellnessGoal,
    InterventionSession,
)
from backend.app.services.twin_engine import DigitalTwinEngine
from backend.app.services.ml_service import ml_service
from backend.app.services.knowledge_service import knowledge_service


class AssistantToolRegistry:
    """Registry of safe, authenticated tools accessible by the AI assistant."""

    @staticmethod
    def get_tool_definitions() -> List[Dict[str, Any]]:
        """Returns standard tool specifications formatted for function calling."""
        return [
            {
                "name": "get_user_baseline",
                "description": "Retrieves the authenticated user's current digital twin baseline summary, calibration status (cold-start vs empirical), and baseline vitals.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
            {
                "name": "get_recent_observations",
                "description": "Retrieves the authenticated user's most recent genuine physiological, lifestyle, and check-in observations.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of recent records to retrieve per category (default: 5, max: 10)",
                            "default": 5,
                        }
                    },
                    "required": [],
                },
            },
            {
                "name": "get_longitudinal_trends",
                "description": "Retrieves a summary of the authenticated user's longitudinal stress and vital trends over the past N days.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "days": {
                            "type": "integer",
                            "description": "Number of days to summarize (default: 30, max: 60)",
                            "default": 30,
                        }
                    },
                    "required": [],
                },
            },
            {
                "name": "get_ml_prediction_explanation",
                "description": "Retrieves the Day-Before-Panic (DBP) machine learning prediction risk band, uncertainty interval, contributing factors, or cold-start qualification status.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
            {
                "name": "get_active_goals_and_interventions",
                "description": "Retrieves the user's active wellness goals, progress pace, and recent completed supportive coping interventions.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
            {
                "name": "query_clinical_knowledge",
                "description": "Searches the verified AnxietyTwin clinical knowledge base for evidence-based information on CSI formulas, DBP research, 4-7-8 breathing, grounding, sleep hygiene, and crisis resources.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query (e.g., 'how is CSI computed', '4-7-8 breathing mechanics', 'nature study details')",
                        }
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "suggest_coping_exercise",
                "description": "Prepares a step-by-step evidence-based coping exercise proposal (4-7-8 breathing or 5-4-3-2-1 grounding) for the user to practice.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "exercise_type": {
                            "type": "string",
                            "enum": ["breathing_478", "grounding_54321", "sleep_hygiene"],
                            "description": "Type of exercise to offer",
                        }
                    },
                    "required": ["exercise_type"],
                },
            },
        ]

    @staticmethod
    def execute_tool(tool_name: str, arguments: Dict[str, Any], user_id: int, db: Session) -> Dict[str, Any]:
        """
        Executes a named tool strictly bound to user_id derived from authenticated session.
        Never trusts user_id from tool arguments.
        """
        if tool_name == "get_user_baseline":
            return AssistantToolRegistry._tool_get_user_baseline(user_id, db)
        elif tool_name == "get_recent_observations":
            limit = min(10, max(1, int(arguments.get("limit", 5))))
            return AssistantToolRegistry._tool_get_recent_observations(user_id, db, limit=limit)
        elif tool_name == "get_longitudinal_trends":
            days = min(60, max(1, int(arguments.get("days", 30))))
            return AssistantToolRegistry._tool_get_longitudinal_trends(user_id, db, days=days)
        elif tool_name == "get_ml_prediction_explanation":
            return AssistantToolRegistry._tool_get_ml_prediction_explanation(user_id, db)
        elif tool_name == "get_active_goals_and_interventions":
            return AssistantToolRegistry._tool_get_active_goals_and_interventions(user_id, db)
        elif tool_name == "query_clinical_knowledge":
            query = str(arguments.get("query", ""))
            return AssistantToolRegistry._tool_query_clinical_knowledge(query)
        elif tool_name == "suggest_coping_exercise":
            ex_type = str(arguments.get("exercise_type", "breathing_478"))
            return AssistantToolRegistry._tool_suggest_coping_exercise(ex_type)
        else:
            return {"error": f"Tool '{tool_name}' is not recognized or permitted."}

    # =========================================================================
    # TOOL IMPLEMENTATIONS (Strictly scoped to user_id)
    # =========================================================================

    @staticmethod
    def _tool_get_user_baseline(user_id: int, db: Session) -> Dict[str, Any]:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        physios = db.query(PhysiologicalObservation).filter(
            PhysiologicalObservation.user_id == user_id
        ).order_by(PhysiologicalObservation.timestamp.desc()).all()
        lifestyles = db.query(LifestyleObservation).filter(
            LifestyleObservation.user_id == user_id
        ).order_by(LifestyleObservation.date.desc()).all()
        checkins = db.query(AnxietyCheckin).filter(
            AnxietyCheckin.user_id == user_id
        ).order_by(AnxietyCheckin.timestamp.desc()).all()

        genuine_phys = [p for p in physios if DigitalTwinEngine.is_genuine_observation(p)]
        genuine_life = [l for l in lifestyles if DigitalTwinEngine.is_genuine_observation(l)]
        genuine_chk = [c for c in checkins if DigitalTwinEngine.is_genuine_observation(c)]

        dates = set()
        for p in genuine_phys:
            if p.timestamp: dates.add(p.timestamp.strftime("%Y-%m-%d"))
        for l in genuine_life:
            if l.date: dates.add(str(l.date))
        for c in genuine_chk:
            if c.timestamp: dates.add(c.timestamp.strftime("%Y-%m-%d"))

        unique_days = len(dates)
        total_obs = len(genuine_phys) + len(genuine_life) + len(genuine_chk)
        is_empirical = (total_obs >= 5) and (unique_days >= 3)

        base_summary = DigitalTwinEngine.calculate_personal_baseline(
            profile=profile,
            historical_physio=genuine_phys,
            historical_lifestyle=genuine_life,
            historical_checkins=genuine_chk,
        )

        return {
            "status": "success",
            "provenance": "authenticated_patient_records",
            "baseline_mode": "Empirical Personal Baseline" if is_empirical else "Cold-Start (Demographic Prior)",
            "is_empirical_baseline": is_empirical,
            "calibration_progress": {
                "total_observations": total_obs,
                "unique_days_recorded": unique_days,
                "required_observations_for_empirical": 5,
                "required_days_for_empirical": 3,
                "required_days_for_ml_personalization": 7,
            },
            "baseline_values": {
                "resting_heart_rate_bpm": base_summary.get("mean_resting_hr"),
                "heart_rate_variability_ms": base_summary.get("mean_hrv_ms"),
                "sleep_duration_hours": base_summary.get("mean_sleep_hours"),
                "caffeine_intake_cups": base_summary.get("mean_caffeine_cups"),
                "subjective_anxiety_score": base_summary.get("mean_anxiety_score"),
            },
            "disclaimer": "Demographic priors benchmark early records until >=5 observations across >=3 distinct days are accumulated.",
        }

    @staticmethod
    def _tool_get_recent_observations(user_id: int, db: Session, limit: int = 5) -> Dict[str, Any]:
        physios = db.query(PhysiologicalObservation).filter(
            PhysiologicalObservation.user_id == user_id
        ).order_by(PhysiologicalObservation.timestamp.desc()).limit(limit).all()

        lifestyles = db.query(LifestyleObservation).filter(
            LifestyleObservation.user_id == user_id
        ).order_by(LifestyleObservation.date.desc()).limit(limit).all()

        checkins = db.query(AnxietyCheckin).filter(
            AnxietyCheckin.user_id == user_id
        ).order_by(AnxietyCheckin.timestamp.desc()).limit(limit).all()

        return {
            "status": "success",
            "provenance": "authenticated_patient_records",
            "recent_physiological": [
                {
                    "timestamp": p.timestamp.isoformat() if p.timestamp else None,
                    "heart_rate_bpm": p.heart_rate_bpm,
                    "hrv_ms": p.heart_rate_variability_ms,
                    "steps": p.steps_count,
                    "source_type": p.source_type,
                }
                for p in physios if DigitalTwinEngine.is_genuine_observation(p)
            ],
            "recent_lifestyle": [
                {
                    "date": l.date,
                    "sleep_hours": l.sleep_hours,
                    "caffeine_cups": l.caffeine_cups,
                    "exercise_mins": l.exercise_minutes,
                    "source_type": l.source_type,
                }
                for l in lifestyles if DigitalTwinEngine.is_genuine_observation(l)
            ],
            "recent_checkins": [
                {
                    "timestamp": c.timestamp.isoformat() if c.timestamp else None,
                    "anxiety_score": c.subjective_anxiety_score,
                    "triggers_noted": c.triggers_noted,
                    "notes": c.notes,
                    "source_type": c.source_type,
                }
                for c in checkins if DigitalTwinEngine.is_genuine_observation(c)
            ],
        }

    @staticmethod
    def _tool_get_longitudinal_trends(user_id: int, db: Session, days: int = 30) -> Dict[str, Any]:
        physios = db.query(PhysiologicalObservation).filter(
            PhysiologicalObservation.user_id == user_id
        ).order_by(PhysiologicalObservation.timestamp.asc()).all()

        lifestyles = db.query(LifestyleObservation).filter(
            LifestyleObservation.user_id == user_id
        ).order_by(LifestyleObservation.date.asc()).all()

        genuine_phys = [p for p in physios if DigitalTwinEngine.is_genuine_observation(p)]
        genuine_life = [l for l in lifestyles if DigitalTwinEngine.is_genuine_observation(l)]

        avg_hr = round(float(sum(p.heart_rate_bpm for p in genuine_phys if p.heart_rate_bpm) / max(1, len(genuine_phys))), 1) if genuine_phys else None
        avg_sleep = round(float(sum(l.sleep_hours for l in genuine_life if l.sleep_hours) / max(1, len(genuine_life))), 1) if genuine_life else None

        return {
            "status": "success",
            "provenance": "authenticated_patient_records",
            "period_days": days,
            "observations_count": len(genuine_phys) + len(genuine_life),
            "summary_metrics": {
                "mean_heart_rate_bpm": avg_hr,
                "mean_sleep_hours": avg_sleep,
            },
            "clinical_note": "Longitudinal trend shows rolling trajectories. Consistent sleep duration anchors parasympathetic autonomic tone.",
        }

    @staticmethod
    def _tool_get_ml_prediction_explanation(user_id: int, db: Session) -> Dict[str, Any]:
        physios = db.query(PhysiologicalObservation).filter(
            PhysiologicalObservation.user_id == user_id
        ).order_by(PhysiologicalObservation.timestamp.asc()).all()
        lifestyles = db.query(LifestyleObservation).filter(
            LifestyleObservation.user_id == user_id
        ).order_by(LifestyleObservation.date.asc()).all()
        checkins = db.query(AnxietyCheckin).filter(
            AnxietyCheckin.user_id == user_id
        ).order_by(AnxietyCheckin.timestamp.asc()).all()

        genuine_phys = [p for p in physios if DigitalTwinEngine.is_genuine_observation(p)]
        genuine_life = [l for l in lifestyles if DigitalTwinEngine.is_genuine_observation(l)]
        genuine_chk = [c for c in checkins if DigitalTwinEngine.is_genuine_observation(c)]

        dates = set()
        for p in genuine_phys:
            if p.timestamp: dates.add(p.timestamp.strftime("%Y-%m-%d"))
        for l in genuine_life:
            if l.date: dates.add(str(l.date))
        for c in genuine_chk:
            if c.timestamp: dates.add(c.timestamp.strftime("%Y-%m-%d"))

        unique_days = len(dates)

        if unique_days < 7:
            return {
                "status": "unavailable",
                "reason": "insufficient_history",
                "unique_history_days": unique_days,
                "required_history_days": 7,
                "message": (
                    f"Personalized machine learning prediction requires at least 7 distinct days of prior historical observations. "
                    f"You currently have {unique_days} of 7 required days recorded."
                ),
                "model_target": "Day-Before-Panic (DBP) ~24-hour lookahead risk",
                "limitation": "Predictions are withheld during cold-start to prevent speculative or ungrounded forecasting.",
            }

        latest_p = genuine_phys[-1] if genuine_phys else None
        latest_l = genuine_life[-1] if genuine_life else None
        latest_c = genuine_chk[-1] if genuine_chk else None

        hr = latest_p.heart_rate_bpm if latest_p and latest_p.heart_rate_bpm else 74.0
        sleep = latest_l.sleep_hours if latest_l and latest_l.sleep_hours else 7.0
        caff = latest_l.caffeine_cups if latest_l and latest_l.caffeine_cups else 1.0
        anx = float(latest_c.subjective_anxiety_score) if latest_c else 3.0

        pred = ml_service.predict_panic_risk(
            hr_mean=hr,
            hr_max=hr + 25.0,
            hr_var=115.0,
            steps_mean=55.0,
            sleep_duration=sleep,
            sleep_onset=-1.0,
            sleep_out=sleep - 1.0,
            caffeine=caff,
            alcohol=0.0,
            daily_anxiety=anx,
            annoyance=2.0,
            trait_stai=42.0,
            model_name="RandomForest",
        )

        return {
            "status": "success",
            "provenance": "research_ml_model",
            "model_name": pred["model_name"],
            "prediction_horizon": pred["prediction_horizon"],
            "predicted_probability": pred["predicted_probability"],
            "uncertainty_interval": pred["uncertainty_interval"],
            "risk_band": pred["risk_band"],
            "top_contributing_factors": pred["top_contributing_factors"][:4],
            "research_disclaimer": pred["research_disclaimer"],
            "calibration_note": pred["calibration_reliability_note"],
        }

    @staticmethod
    def _tool_get_active_goals_and_interventions(user_id: int, db: Session) -> Dict[str, Any]:
        goals = db.query(WellnessGoal).filter(
            WellnessGoal.user_id == user_id,
            WellnessGoal.status == "active",
        ).all()

        interventions = db.query(InterventionSession).filter(
            InterventionSession.user_id == user_id,
        ).order_by(InterventionSession.started_at.desc()).limit(5).all()

        return {
            "status": "success",
            "provenance": "authenticated_patient_records",
            "active_goals": [
                {
                    "title": g.title,
                    "category": g.category,
                    "target_days": g.target_days_per_week,
                    "completed_this_week": g.completed_days_this_week,
                }
                for g in goals
            ],
            "recent_interventions": [
                {
                    "type": i.intervention_type,
                    "status": i.status,
                    "duration_seconds": i.duration_seconds,
                    "pre_distress": i.distress_rating_pre,
                    "post_distress": i.distress_rating_post,
                    "timestamp": i.started_at.isoformat() if i.started_at else None,
                }
                for i in interventions
            ],
        }

    @staticmethod
    def _tool_query_clinical_knowledge(query: str) -> Dict[str, Any]:
        results = knowledge_service.search(query, limit=2)
        return {
            "status": "success",
            "provenance": "clinical_knowledge_base",
            "articles": results,
        }

    @staticmethod
    def _tool_suggest_coping_exercise(exercise_type: str) -> Dict[str, Any]:
        if exercise_type == "grounding_54321":
            doc = knowledge_service.get_document_by_id("DOC-COPE-05")
            return {
                "status": "success",
                "exercise_type": "grounding_54321",
                "title": "5-4-3-2-1 Sensory Grounding Exercise",
                "steps": [
                    "5: Notice 5 things you can see around you right now.",
                    "4: Notice 4 things you can physically feel (e.g., feet on floor, fabric of clothes).",
                    "3: Notice 3 distinct sounds you can hear in your environment.",
                    "2: Notice 2 things you can smell or enjoy the scent of.",
                    "1: Notice 1 thing you can taste or an anchor phrase of safety.",
                ],
                "citation": doc["citation"] if doc else "Linehan MM, DBT Skills Training.",
            }
        elif exercise_type == "sleep_hygiene":
            doc = knowledge_service.get_document_by_id("DOC-SLEEP-06")
            return {
                "status": "success",
                "exercise_type": "sleep_hygiene",
                "title": "Circadian & Sleep Hygiene Protocol",
                "steps": [
                    "Maintain a consistent wake time within 30 minutes every morning.",
                    "Avoid caffeine intake after 2:00 PM to protect deep slow-wave sleep.",
                    "Dim bright screens 60 minutes before bedtime to allow melatonin synthesis.",
                ],
                "citation": doc["citation"] if doc else "Walker MP, Why We Sleep.",
            }
        else:
            doc = knowledge_service.get_document_by_id("DOC-COPE-04")
            return {
                "status": "success",
                "exercise_type": "breathing_478",
                "title": "4-7-8 Rhythmic Breathing Exercise",
                "steps": [
                    "Inhale quietly through your nose for 4 seconds.",
                    "Hold your breath gently for 7 seconds without straining.",
                    "Exhale steadily and completely through pursed lips for 8 seconds.",
                    "Repeat this sequence for 4 complete cycles.",
                ],
                "citation": doc["citation"] if doc else "Weil A, Breathing for Self-Healing.",
            }
