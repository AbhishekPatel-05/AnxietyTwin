"""
AnxietyTwin - AI Clinical Assistant API Router
Provides authenticated endpoints for conversational interaction, session history,
tool execution, and provider configuration.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.db_models import User
from backend.app.api.deps import get_current_user
from backend.app.services.assistant_service import assistant_service


router = APIRouter(prefix="/assistant", tags=["AI Clinical Assistant"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User question or statement")
    session_id: str = Field(default="default", max_length=100, description="Conversation session identifier")


class ChatResponse(BaseModel):
    role: str = "assistant"
    content: str
    timestamp: str
    provenance: List[str]
    citations: List[str]
    tool_calls: List[Dict[str, Any]]
    provider: str
    model: str


class HistoryResponse(BaseModel):
    session_id: str
    messages: List[Dict[str, Any]]


class ConfigResponse(BaseModel):
    active_provider: str
    model: str
    is_live_hosted: bool
    supported_providers: List[str]
    available_tools: List[str]
    safety_guardrail_active: bool


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Interacts with the AnxietyTwin AI Assistant.
    Securely derives user context from the authenticated session.
    """
    try:
        msg = await assistant_service.chat(
            user_message=req.message,
            user_id=current_user.id,
            session_id=req.session_id,
            db=db,
        )
        return ChatResponse(
            role=msg.role,
            content=msg.content,
            timestamp=msg.timestamp,
            provenance=msg.provenance,
            citations=msg.citations,
            tool_calls=msg.tool_calls,
            provider=assistant_service.get_configured_provider_name(),
            model=assistant_service.get_configured_model_name(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Assistant processing error: {str(e)}",
        )


@router.get("/history", response_model=HistoryResponse)
def get_chat_history(
    session_id: str = Query("default", description="Session identifier"),
    current_user: User = Depends(get_current_user),
):
    """Retrieves conversation history for the authenticated user and session."""
    history = assistant_service.get_conversation_history(
        user_id=current_user.id,
        session_id=session_id,
    )
    return HistoryResponse(session_id=session_id, messages=history)


@router.delete("/history")
def clear_chat_history(
    session_id: str = Query("default", description="Session identifier"),
    current_user: User = Depends(get_current_user),
):
    """Erases conversation history for privacy compliance."""
    success = assistant_service.clear_conversation_history(
        user_id=current_user.id,
        session_id=session_id,
    )
    return {"status": "success", "session_id": session_id, "cleared": success}


@router.get("/config", response_model=ConfigResponse)
def get_assistant_config(
    current_user: User = Depends(get_current_user),
):
    """Returns active provider configuration, model name, and supported tools."""
    provider = assistant_service.get_configured_provider_name()
    return ConfigResponse(
        active_provider=provider,
        model=assistant_service.get_configured_model_name(),
        is_live_hosted=provider in ("Google Gemini", "OpenAI", "Anthropic"),
        supported_providers=["Google Gemini", "OpenAI", "Anthropic", "Local Ollama", "Grounded Clinical Engine"],
        available_tools=[
            "get_user_baseline",
            "get_recent_observations",
            "get_longitudinal_trends",
            "get_ml_prediction_explanation",
            "get_active_goals_and_interventions",
            "query_clinical_knowledge",
            "suggest_coping_exercise",
        ],
        safety_guardrail_active=True,
    )
