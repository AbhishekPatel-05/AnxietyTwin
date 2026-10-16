"""
weekly_report_service.py - Feature 7: Weekly Personal Insights Report Service
Generates structured weekly summaries of check-ins, vitals, baseline shifts, patterns,
coping feedback, goal progress, and ReportLab PDF exports.
Strictly non-causal: does not claim changes prove recovery or clinical treatment efficacy.
Private reflections excluded by default unless explicitly authorized.
"""

import io
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

from backend.app.models.db_models import (
    User,
    AnxietyCheckin,
    PhysiologicalObservation,
    LifestyleObservation,
    InterventionSession,
    DiscoveredPattern,
    WellnessGoal,
    EmotionJournalEntry,
)
from backend.app.models.schemas import WeeklyReportRequest, WeeklyReportOut
from backend.app.services.goal_service import serialize_goal_with_progress


def compile_weekly_report_data(user_id: int, req: WeeklyReportRequest, db: Session) -> WeeklyReportOut:
    now = datetime.now(timezone.utc)
    if req.end_date:
        try:
            end_dt = datetime.fromisoformat(req.end_date).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        except Exception:
            end_dt = now
    else:
        end_dt = now

    if req.start_date:
        try:
            start_dt = datetime.fromisoformat(req.start_date).replace(hour=0, minute=0, second=0, tzinfo=timezone.utc)
        except Exception:
            start_dt = end_dt - timedelta(days=7)
    else:
        start_dt = end_dt - timedelta(days=7)

    start_str = start_dt.strftime("%Y-%m-%d")
    end_str = end_dt.strftime("%Y-%m-%d")

    # Fetch period records
    checkins = (
        db.query(AnxietyCheckin)
        .filter(AnxietyCheckin.user_id == user_id, AnxietyCheckin.timestamp >= start_dt, AnxietyCheckin.timestamp <= end_dt)
        .order_by(AnxietyCheckin.timestamp.asc())
        .all()
    )
    physios = (
        db.query(PhysiologicalObservation)
        .filter(PhysiologicalObservation.user_id == user_id, PhysiologicalObservation.timestamp >= start_dt, PhysiologicalObservation.timestamp <= end_dt)
        .all()
    )
    lifestyles = (
        db.query(LifestyleObservation)
        .filter(LifestyleObservation.user_id == user_id, LifestyleObservation.date >= start_str, LifestyleObservation.date <= end_str)
        .all()
    )
    sessions = (
        db.query(InterventionSession)
        .filter(InterventionSession.user_id == user_id, InterventionSession.started_at >= start_dt, InterventionSession.started_at <= end_dt)
        .all()
    )
    # Quarantine synthetic and simulated data: personal reports use only genuine telemetry
    checkins = [c for c in checkins if (c.source_type or "user_entered") not in ["synthetic", "simulated"]]
    physios = [p for p in physios if (p.source_type or "user_entered") not in ["synthetic", "simulated"]]
    lifestyles = [l for l in lifestyles if (l.source_type or "user_entered") not in ["synthetic", "simulated"]]
    sessions = [s for s in sessions if (s.source_type or "user_entered") not in ["synthetic", "simulated"]]

    # User profile baseline
    user = db.query(User).filter(User.id == user_id).first()
    profile = user.profile if user else None
    base_hr = profile.baseline_resting_hr if profile else 72.0
    base_sleep = profile.baseline_sleep_hours if profile else 7.5
    base_hrv = profile.baseline_hrv_ms if profile else 45.0

    # 1. Check-in summary & distress trend
    scores = [c.subjective_anxiety_score for c in checkins if c.subjective_anxiety_score is not None]
    avg_distress = round(sum(scores) / len(scores), 1) if scores else None

    trend = "insufficient_data"
    if len(scores) >= 3:
        first_half = scores[: len(scores) // 2]
        second_half = scores[len(scores) // 2 :]
        m1 = sum(first_half) / len(first_half)
        m2 = sum(second_half) / len(second_half)
        diff = m2 - m1
        if diff >= 1.0:
            trend = "increasing"
        elif diff <= -1.0:
            trend = "decreasing"
        else:
            trend = "stable"

    # 2. Vitals averages
    hr_vals = [p.heart_rate_bpm for p in physios if p.heart_rate_bpm is not None]
    avg_hr = round(sum(hr_vals) / len(hr_vals), 1) if hr_vals else None

    hrv_vals = [p.heart_rate_variability_ms for p in physios if p.heart_rate_variability_ms is not None]
    avg_hrv = round(sum(hrv_vals) / len(hrv_vals), 1) if hrv_vals else None

    sleep_vals = [l.sleep_hours for l in lifestyles if l.sleep_hours is not None]
    avg_sleep = round(sum(sleep_vals) / len(sleep_vals), 1) if sleep_vals else None

    # 3. Significant baseline shifts
    deviations = []
    if avg_hr is not None and abs(avg_hr - base_hr) >= 4.0:
        d = round(avg_hr - base_hr, 1)
        deviations.append({
            "metric": "Resting Heart Rate",
            "weekly_average": avg_hr,
            "baseline": base_hr,
            "delta": f"{d:+0.1f} BPM",
            "interpretation": "Elevated resting pulse indicates higher autonomic arousal" if d > 0 else "Lower resting pulse",
        })

    if avg_sleep is not None and abs(avg_sleep - base_sleep) >= 0.75:
        d = round(avg_sleep - base_sleep, 1)
        deviations.append({
            "metric": "Sleep Duration",
            "weekly_average": avg_sleep,
            "baseline": base_sleep,
            "delta": f"{d:+0.1f} hours",
            "interpretation": "Sleep reduction relative to typical routine" if d < 0 else "Extended sleep duration",
        })

    if avg_hrv is not None and abs(avg_hrv - base_hrv) >= 6.0:
        d = round(avg_hrv - base_hrv, 1)
        deviations.append({
            "metric": "Heart Rate Variability (RMSSD)",
            "weekly_average": avg_hrv,
            "baseline": base_hrv,
            "delta": f"{d:+0.1f} ms",
            "interpretation": "Parasympathetic suppression" if d < 0 else "Vagal tone recovery",
        })

    # 4. Recurring patterns
    patterns_out = []
    if req.include_patterns:
        pats = db.query(DiscoveredPattern).filter(DiscoveredPattern.user_id == user_id, DiscoveredPattern.status == "active").all()
        for p in pats:
            patterns_out.append({
                "title": p.title,
                "confidence": p.confidence_level,
                "observation_count": p.observation_count,
                "description": p.description,
            })

    # 5. Coping activities & helpfulness feedback
    completed_sessions = [s for s in sessions if s.status == "completed"]
    helpful_count = sum(1 for s in completed_sessions if s.helpfulness in ["helpful", "somewhat_helpful"])
    deltas = [s.rating_delta for s in completed_sessions if s.rating_delta is not None]
    avg_delta = round(sum(deltas) / len(deltas), 1) if deltas else 0.0

    coping_summary = {
        "total_completed": len(completed_sessions),
        "reported_helpful": helpful_count,
        "average_distress_reduction": avg_delta,
        "interventions_used": list(set(s.intervention_type.replace("_", " ").title() for s in completed_sessions)),
    }

    # 6. Wellness goals progress
    goals_progress = []
    if req.include_goals:
        active_goals = db.query(WellnessGoal).filter(WellnessGoal.user_id == user_id, WellnessGoal.status == "active").all()
        for g in active_goals:
            sg = serialize_goal_with_progress(g, db)
            goals_progress.append({
                "title": sg.title,
                "category": sg.category,
                "progress": sg.current_week_progress,
                "target": sg.current_week_target,
                "is_on_track": sg.is_on_track,
            })

    # 7. Optional sensitive reflections summary (only if requested)
    reflections_summary = None
    if req.include_journal_summary:
        journals = (
            db.query(EmotionJournalEntry)
            .filter(EmotionJournalEntry.user_id == user_id, EmotionJournalEntry.created_at >= start_dt, EmotionJournalEntry.created_at <= end_dt)
            .all()
        )
        if journals:
            moods = []
            for j in journals:
                moods.extend(j.mood_tags)
            reflections_summary = (
                f"You recorded {len(journals)} personal journal reflections during this period. "
                f"Predominant emotional themes included: {', '.join(set(moods)) if moods else 'daily reflections'}."
            )
        else:
            reflections_summary = "No journal reflections recorded during this period."

    # 8. Data quality & missing observations notices
    notices = []
    if len(checkins) < 3:
        notices.append(f"Only {len(checkins)} check-in(s) recorded in this 7-day period. Trends are preliminary.")
    if not physios:
        notices.append("No physiological vitals recorded during this period.")
    if not lifestyles:
        notices.append("No sleep observations recorded during this period.")

    return WeeklyReportOut(
        period_start=start_str,
        period_end=end_str,
        checkin_count=len(checkins),
        avg_distress_rating=avg_distress,
        distress_trend=trend,
        resting_hr_avg=avg_hr,
        hrv_avg_ms=avg_hrv,
        sleep_avg_hours=avg_sleep,
        baseline_deviations=deviations,
        recurring_patterns=patterns_out,
        coping_interventions_summary=coping_summary,
        wellness_goals_progress=goals_progress,
        private_reflections_included=req.include_journal_summary,
        reflections_summary=reflections_summary,
        data_quality_notices=notices,
        disclaimer=(
            "This weekly personal summary is intended for self-reflection and personal wellness awareness. "
            "Changes in ratings or physiological metrics do not establish clinical recovery, deterioration, or medical efficacy."
        ),
    )


def generate_weekly_report_pdf(report: WeeklyReportOut, user_name: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "SubTitleStyle",
        parent=styles["Normal"],
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#475569"),
        spaceAfter=10,
    )
    section_title = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#0f766e"),
        spaceBefore=8,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1e293b"),
    )
    disclaimer_style = ParagraphStyle(
        "Disclaimer",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748b"),
    )

    story = []

    # Title & Period
    story.append(Paragraph("AnxietyTwin — Weekly Personal Insights Report", title_style))
    story.append(
        Paragraph(
            f"<b>Participant:</b> {user_name} | <b>Reporting Window:</b> {report.period_start} to {report.period_end}",
            subtitle_style,
        )
    )
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f766e"), spaceAfter=8))

    # Overview Metrics Table
    story.append(Paragraph("1. Weekly Activity & Telemetry Overview", section_title))
    t_data = [
        ["Metric", "Value / Rating", "Context / Trend"],
        ["Completed Check-ins", f"{report.checkin_count} check-ins", "Self-reported entries"],
        ["Average Distress Rating", f"{report.avg_distress_rating or 'N/A'} / 10", f"Trend: {report.distress_trend.replace('_', ' ').title()}"],
        ["Resting Heart Rate", f"{report.resting_hr_avg or 'N/A'} BPM", "7-day resting average"],
        ["Heart Rate Variability", f"{report.hrv_avg_ms or 'N/A'} ms", "RMSSD vagal index"],
        ["Average Sleep Duration", f"{report.sleep_avg_hours or 'N/A'} hrs/night", "Lifestyle tracking"],
    ]
    t_table = Table(t_data, colWidths=[180, 160, 200])
    t_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_table)
    story.append(Spacer(1, 8))

    # Baseline Deviations
    if report.baseline_deviations:
        story.append(Paragraph("2. Notable Changes Relative to Personal Baseline", section_title))
        dev_rows = [["Metric", "Weekly Average", "Baseline", "Difference", "Context"]]
        for d in report.baseline_deviations:
            dev_rows.append([d["metric"], str(d["weekly_average"]), str(d["baseline"]), d["delta"], d["interpretation"]])
        t_dev = Table(dev_rows, colWidths=[130, 80, 80, 80, 170])
        t_dev.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ])
        )
        story.append(t_dev)
        story.append(Spacer(1, 8))

    # Coping Interventions
    story.append(Paragraph("3. Coping Activities & Helpfulness Feedback", section_title))
    cop = report.coping_interventions_summary
    story.append(
        Paragraph(
            f"<b>Completed Sessions:</b> {cop.get('total_completed', 0)} | "
            f"<b>Reported Helpful:</b> {cop.get('reported_helpful', 0)} | "
            f"<b>Avg Immediate Distress Change:</b> {cop.get('average_distress_reduction', 0.0)} points<br/>"
            f"<b>Techniques Practiced:</b> {', '.join(cop.get('interventions_used', [])) or 'None recorded this week'}",
            body_style,
        )
    )
    story.append(Spacer(1, 8))

    # Recurring Patterns (Non-Causal Associations)
    if report.recurring_patterns:
        story.append(Paragraph("4. Observed Patterns & Context Associations (Non-Causal)", section_title))
        p_rows = [["Pattern Title", "Confidence Tier", "Obs. Count", "Context"]]
        for p in report.recurring_patterns:
            p_rows.append([p["title"], p.get("confidence", "preliminary").title(), str(p.get("observation_count", 0)), p.get("description", "")[:60] + "..."])
        t_pats = Table(p_rows, colWidths=[180, 100, 80, 180])
        t_pats.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ])
        )
        story.append(t_pats)
        story.append(Spacer(1, 8))

    # Wellness Goals Progress
    if report.wellness_goals_progress:
        story.append(Paragraph("5. Wellness Goals Progress", section_title))
        g_rows = [["Goal Title", "Category", "Completed / Target", "Status"]]
        for g in report.wellness_goals_progress:
            g_rows.append([g["title"], g["category"].replace("_", " ").title(), f"{g['progress']} / {g['target']}", "On Track" if g["is_on_track"] else "In Progress"])
        t_goals = Table(g_rows, colWidths=[200, 120, 110, 110])
        t_goals.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ])
        )
        story.append(t_goals)
        story.append(Spacer(1, 8))

    # Optional Private Reflections
    if report.private_reflections_included and report.reflections_summary:
        story.append(Paragraph("5. Personal Reflections Summary (User-Authorized)", section_title))
        story.append(Paragraph(report.reflections_summary, body_style))
        story.append(Spacer(1, 8))

    # Data Quality Notices
    if report.data_quality_notices:
        story.append(Paragraph("Data Quality Notices", section_title))
        for n in report.data_quality_notices:
            story.append(Paragraph(f"• {n}", body_style))
        story.append(Spacer(1, 8))

    # Scientific Disclaimer
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceAfter=6))
    story.append(Paragraph(report.disclaimer, disclaimer_style))

    doc.build(story)
    return buffer.getvalue()
