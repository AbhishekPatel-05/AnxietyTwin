"""
reports.py - Feature 7: Weekly Personal Insights Report API Router
Endpoints:
- GET /api/reports/weekly: Structured weekly report JSON
- POST /api/reports/weekly/pdf: Downloadable ReportLab PDF weekly report
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.db_models import User
from backend.app.models.schemas import WeeklyReportRequest, WeeklyReportOut
from backend.app.api.deps import get_current_user
from backend.app.services.weekly_report_service import compile_weekly_report_data, generate_weekly_report_pdf

router = APIRouter(prefix="/reports", tags=["Personal Insights Reports"])


@router.get("/weekly", response_model=WeeklyReportOut)
def get_weekly_personal_report(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    include_journal_summary: bool = Query(False, description="Whether to include private reflection summary (opt-in)"),
    include_goals: bool = Query(True),
    include_patterns: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns an understandable weekly personal insights summary for self-reflection.
    """
    req = WeeklyReportRequest(
        start_date=start_date,
        end_date=end_date,
        include_journal_summary=include_journal_summary,
        include_goals=include_goals,
        include_patterns=include_patterns,
    )
    return compile_weekly_report_data(current_user.id, req, db)


@router.post("/weekly/pdf")
def export_weekly_personal_report_pdf(
    req: WeeklyReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates and downloads a clean, publication-grade ReportLab PDF weekly personal report.
    """
    report_data = compile_weekly_report_data(current_user.id, req, db)
    user_name = current_user.full_name or current_user.email

    pdf_bytes = generate_weekly_report_pdf(report_data, user_name)

    filename = f"AnxietyTwin_Weekly_Report_{report_data.period_start}_to_{report_data.period_end}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
