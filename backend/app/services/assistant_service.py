"""
AnxietyTwin - Advanced Multi-Provider LLM Assistant Service
Supports OpenAI, Google Gemini, Anthropic, Ollama, and Grounded Clinical Engine fallback.
Enforces 988 emergency crisis guardrails, session isolation, and provenance tagging.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
import httpx
from sqlalchemy.orm import Session

from backend.app.services.assistant_tools import AssistantToolRegistry
from backend.app.services.knowledge_service import knowledge_service

logger = logging.getLogger("anxietytwin.assistant")

# Crisis keywords that trigger immediate safety guardrails
CRISIS_KEYWORDS = [
    "suicide", "kill myself", "want to die", "end my life", "end it all",
    "self-harm", "self harm", "cutting", "overdose", "hang myself",
    "take my life", "better off dead", "no reason to live", "can't go on living"
]


class AssistantMessage:
    def __init__(
        self,
        role: str,
        content: str,
        timestamp: Optional[str] = None,
        provenance: Optional[List[str]] = None,
        citations: Optional[List[str]] = None,
        tool_calls: Optional[List[Dict[str, Any]]] = None,
    ):
        self.role = role
        self.content = content
        self.timestamp = timestamp or datetime.now(timezone.utc).isoformat()
        self.provenance = provenance or []
        self.citations = citations or []
        self.tool_calls = tool_calls or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp,
            "provenance": self.provenance,
            "citations": self.citations,
            "tool_calls": self.tool_calls,
        }


class AssistantService:
    def __init__(self):
        # In-memory session history store: Dict[Tuple[int, str], List[AssistantMessage]]
        self._conversations: Dict[Tuple[int, str], List[AssistantMessage]] = {}

    def get_configured_provider_name(self) -> str:
        """Determines the active LLM provider based on environment configuration."""
        if os.getenv("GEMINI_API_KEY"):
            return "Google Gemini"
        elif os.getenv("OPENAI_API_KEY"):
            return "OpenAI"
        elif os.getenv("ANTHROPIC_API_KEY"):
            return "Anthropic"
        elif os.getenv("OLLAMA_BASE_URL"):
            return "Local Ollama"
        return "Grounded Clinical Engine"

    def get_configured_model_name(self) -> str:
        provider = self.get_configured_provider_name()
        if provider == "Google Gemini":
            return os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        elif provider == "OpenAI":
            return os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        elif provider == "Anthropic":
            return os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet")
        elif provider == "Local Ollama":
            return os.getenv("OLLAMA_MODEL", "llama3.2")
        return "AnxietyTwin-Clinical-RAG-v2"

    def get_conversation_history(self, user_id: int, session_id: str = "default") -> List[Dict[str, Any]]:
        key = (user_id, session_id)
        msgs = self._conversations.get(key, [])
        return [m.to_dict() for m in msgs]

    def clear_conversation_history(self, user_id: int, session_id: str = "default") -> bool:
        key = (user_id, session_id)
        if key in self._conversations:
            del self._conversations[key]
            return True
        return False

    def is_crisis_query(self, text: str) -> bool:
        clean = text.lower()
        return any(keyword in clean for keyword in CRISIS_KEYWORDS)

    def generate_crisis_response(self) -> AssistantMessage:
        content = (
            "### Immediate Support & Safety Guardrail\n\n"
            "If you or someone you know is going through a difficult time, please know that you are not alone, "
            "and compassionate, confidential help is available 24/7:\n\n"
            "- **United States & Canada:** Call or text **988** to reach the Suicide & Crisis Lifeline, or text **HOME to 741741** (Crisis Text Line).\n"
            "- **United Kingdom:** Call **111** (NHS Mental Health) or text **SHOUT to 85258**.\n"
            "- **European Union:** Dial **112** for emergency assistance.\n"
            "- **International / Global Directory:** Visit [findahelpline.com](https://findahelpline.com/) to find immediate, free, confidential local support in your country.\n\n"
            "> **Important Medical Disclosure:** AnxietyTwin is a research digital twin prototype, not an emergency response service or crisis counseling tool. "
            "Please reach out to a trusted professional, loved one, or one of the crisis resources above right now."
        )
        return AssistantMessage(
            role="assistant",
            content=content,
            provenance=["Safety Guardrail (988 Escalation)"],
            citations=["National Suicide Prevention Lifeline (988 Policy)", "IASP Global Crisis Directory"],
        )

    async def chat(
        self,
        user_message: str,
        user_id: int,
        session_id: str = "default",
        db: Optional[Session] = None,
    ) -> AssistantMessage:
        """
        Main entrypoint for AI Assistant interaction.
        1. Checks for crisis keywords.
        2. Retrieves user history.
        3. Attempts configured provider (Gemini / OpenAI / Anthropic / Ollama).
        4. Seamlessly falls back to Grounded Clinical Provider on error or missing keys.
        5. Saves to conversation memory.
        """
        key = (user_id, session_id)
        if key not in self._conversations:
            self._conversations[key] = []

        # Record user message in session
        user_msg_obj = AssistantMessage(role="user", content=user_message)
        self._conversations[key].append(user_msg_obj)

        # 1. Immediate Safety Crisis Guardrail Interceptor
        if self.is_crisis_query(user_message):
            crisis_resp = self.generate_crisis_response()
            self._conversations[key].append(crisis_resp)
            return crisis_resp

        # 2. Provider Routing
        provider = self.get_configured_provider_name()
        response_msg: Optional[AssistantMessage] = None

        if provider == "Google Gemini":
            try:
                response_msg = await self._call_gemini(user_message, user_id, session_id, db)
            except Exception as e:
                logger.warning(f"Gemini API call failed: {e}. Falling back to Grounded Clinical Engine.")
        elif provider == "OpenAI":
            try:
                response_msg = await self._call_openai(user_message, user_id, session_id, db)
            except Exception as e:
                logger.warning(f"OpenAI API call failed: {e}. Falling back to Grounded Clinical Engine.")
        elif provider == "Anthropic":
            try:
                response_msg = await self._call_anthropic(user_message, user_id, session_id, db)
            except Exception as e:
                logger.warning(f"Anthropic API call failed: {e}. Falling back to Grounded Clinical Engine.")
        elif provider == "Local Ollama":
            try:
                response_msg = await self._call_ollama(user_message, user_id, session_id, db)
            except Exception as e:
                logger.warning(f"Ollama API call failed: {e}. Falling back to Grounded Clinical Engine.")

        # 3. Fallback or Default Execution
        if not response_msg:
            response_msg = self._call_grounded_clinical_engine(user_message, user_id, db)

        # Store in session memory (limit history to last 20 messages)
        self._conversations[key].append(response_msg)
        if len(self._conversations[key]) > 20:
            self._conversations[key] = self._conversations[key][-20:]

        return response_msg

    # =========================================================================
    # GROUNDED CLINICAL INTENT & RAG ENGINE (Offline / Air-Gapped / Fallback)
    # =========================================================================

    def _call_grounded_clinical_engine(
        self,
        user_message: str,
        user_id: int,
        db: Optional[Session],
    ) -> AssistantMessage:
        """
        High-capability deterministic reasoning engine that executes authorized backend tools,
        retrieves clinical knowledge articles with citations, and formats explainable responses.
        """
        msg_lower = user_message.lower()
        provenance = []
        citations = []
        tool_calls = []

        # Intent 1: Check-in / Current Vitals / Recent Observations
        if any(w in msg_lower for w in ["vital", "recent", "heart rate", "hrv", "observation", "reading", "latest data", "logged"]):
            if db:
                obs_data = AssistantToolRegistry.execute_tool("get_recent_observations", {"limit": 3}, user_id, db)
                tool_calls.append({"tool": "get_recent_observations", "result": obs_data})
                provenance.append("Authenticated Patient Telemetry")

                phys = obs_data.get("recent_physiological", [])
                life = obs_data.get("recent_lifestyle", [])
                chk = obs_data.get("recent_checkins", [])

                parts = ["### Recent Observations Summary\n"]
                if phys:
                    latest_p = phys[0]
                    parts.append(f"- **Resting Heart Rate:** {latest_p.get('heart_rate_bpm', 'Unrecorded')} BPM")
                    parts.append(f"- **Heart Rate Variability (HRV RMSSD):** {latest_p.get('hrv_ms', 'Unrecorded')} ms")
                if life:
                    latest_l = life[0]
                    parts.append(f"- **Sleep Duration:** {latest_l.get('sleep_hours', 'Unrecorded')} hours")
                    parts.append(f"- **Caffeine Intake:** {latest_l.get('caffeine_cups', 0)} cups")
                if chk:
                    latest_c = chk[0]
                    parts.append(f"- **Self-Reported Distress:** {latest_c.get('anxiety_score', 'None')}/10")
                    if latest_c.get("triggers_noted"):
                        parts.append(f"- **Tagged Context Triggers:** {latest_c.get('triggers_noted')}")

                if not phys and not life and not chk:
                    parts.append("You have not recorded any recent observations yet. You can complete a Quick Check-In on your dashboard.")

                parts.append("\n*Data is sourced directly from your genuine personal records with strict privacy isolation.*")
                return AssistantMessage(
                    role="assistant",
                    content="\n".join(parts),
                    provenance=provenance,
                    citations=["AnxietyTwin Patient Telemetry Store"],
                    tool_calls=tool_calls,
                )

        # Intent 2: Composite Stress Index (CSI) or Score Explanation
        if any(w in msg_lower for w in ["csi", "stress index", "composite stress", "score", "why is my stress", "formula", "calculate stress"]):
            doc = knowledge_service.get_document_by_id("DOC-CSI-01")
            citations.append(doc["citation"])
            provenance.append("Platform Architecture & Clinical Specification")

            baseline_data = {}
            if db:
                baseline_data = AssistantToolRegistry.execute_tool("get_user_baseline", {}, user_id, db)
                tool_calls.append({"tool": "get_user_baseline", "result": baseline_data})
                provenance.append("Authenticated Baseline Engine")

            cal_mode = baseline_data.get("baseline_mode", "Calibrating")
            is_empirical = baseline_data.get("is_empirical_baseline", False)

            content = (
                "### Understanding the Composite Stress Index (CSI)\n\n"
                "The **Composite Stress Index (CSI)** is AnxietyTwin's continuous 0–100 scale measuring multi-modal physiological and autonomic strain:\n\n"
                "1. **Autonomic Arousal (35% weight):** Measured from resting heart rate surges and suppressed parasympathetic tone (HRV RMSSD).\n"
                "2. **Circadian Disruption (25% weight):** Derived from sleep deficits (<7 hours) and excessive caffeine intake (>2 cups).\n"
                "3. **Subjective Mood (20% weight):** Your self-reported distress rating on the daily 0–10 check-in.\n"
                "4. **Baseline Departure (20% weight):** The absolute divergence of today's readings from your personal historical norm.\n\n"
                f"> **Your Current Baseline Mode:** **{cal_mode}** "
                f"({baseline_data.get('calibration_progress', {}).get('total_observations', 0)} of 5 observations recorded).\n\n"
                "**Operational Vulnerability Tiers:**\n"
                "- `0 – 30`: Stable Baseline (parasympathetic recovery active)\n"
                "- `30 – 50`: Mild Strain (manageable diurnal load)\n"
                "- `50 – 70`: Elevated Arousal (sympathetic activation detected)\n"
                "- `70 – 100`: High Vulnerability (adverse combination of sleep loss, caffeine, or tachycardia)\n"
            )
            return AssistantMessage(role="assistant", content=content, provenance=provenance, citations=citations, tool_calls=tool_calls)

        # Intent 3: Day-Before-Panic (DBP) or ML Risk Prediction
        if any(w in msg_lower for w in ["dbp", "day before panic", "panic model", "ml", "machine learning", "risk", "predict", "forecast"]):
            doc = knowledge_service.get_document_by_id("DOC-DBP-02")
            citations.append(doc["citation"])
            provenance.append("Research ML Specification (Jang et al. 2024)")

            ml_data = {}
            if db:
                ml_data = AssistantToolRegistry.execute_tool("get_ml_prediction_explanation", {}, user_id, db)
                tool_calls.append({"tool": "get_ml_prediction_explanation", "result": ml_data})

            if ml_data.get("status") == "unavailable":
                content = (
                    "### Day-Before-Panic (DBP) Research Model Status: Cold-Start\n\n"
                    f"**Current Status:** {ml_data.get('message')}\n\n"
                    "**How the Research Model Works:**\n"
                    "- **Target Variable:** The model predicts **Day-Before-Panic (DBP)** risk at an approximate **24-hour prospective horizon**, "
                    "derived from the 2024 Nature Scientific Data digital phenotyping cohort (Jang et al.).\n"
                    "- **Prevalence Benchmark:** The underlying research cohort exhibited a 6.4% baseline panic prevalence.\n"
                    "- **Zero-Fabrication Policy:** The system withholds personalized predictions until at least 7 days of genuine history are accumulated "
                    "to prevent misleading or synthetic forecasts."
                )
            else:
                prob = ml_data.get("predicted_probability", 0.0)
                band = ml_data.get("risk_band", "LOW")
                factors = ml_data.get("top_contributing_factors", [])
                factor_text = "\n".join([f"- **{f['factor']}:** {f['impact']} (current: {f['current_value']})" for f in factors])

                content = (
                    f"### Day-Before-Panic (DBP) Research ML Prediction\n\n"
                    f"- **Model Architecture:** `{ml_data.get('model_name')}`\n"
                    f"- **Prediction Horizon:** {ml_data.get('prediction_horizon')}\n"
                    f"- **Estimated Vulnerability:** **{prob*100:.1f}%** (Risk Band: **{band}**)\n"
                    f"- **90% Confidence Interval:** `[{ml_data.get('uncertainty_interval', [0,0])[0]*100:.1f}%, {ml_data.get('uncertainty_interval', [0,0])[1]*100:.1f}%]`\n\n"
                    f"**Top Contributing Autonomic & Lifestyle Factors:**\n{factor_text}\n\n"
                    f"> **Important Research Disclaimer:** {ml_data.get('research_disclaimer')}"
                )

            return AssistantMessage(role="assistant", content=content, provenance=provenance, citations=citations, tool_calls=tool_calls)

        # Intent 4: Breathing or Coping Exercise Proposal
        if any(w in msg_lower for w in ["breath", "breathing", "4-7-8", "calm", "relax", "exercise", "grounding", "5-4-3-2-1", "cope", "coping"]):
            is_grounding = "ground" in msg_lower or "5-4-3-2-1" in msg_lower
            ex_type = "grounding_54321" if is_grounding else "breathing_478"

            coping_data = AssistantToolRegistry.execute_tool("suggest_coping_exercise", {"exercise_type": ex_type}, user_id, db or None)
            tool_calls.append({"tool": "suggest_coping_exercise", "result": coping_data})
            provenance.append("Evidence-Based Coping Protocol")
            citations.append(coping_data.get("citation", "Clinical Autonomic Protocol"))

            steps = "\n".join([f"{i+1}. {step}" for i, step in enumerate(coping_data.get("steps", []))])
            content = (
                f"### {coping_data.get('title')}\n\n"
                f"Here is a guided, evidence-based coping exercise you can follow right now:\n\n"
                f"{steps}\n\n"
                "> **Clinical Tip:** You can also launch the interactive visual pacer anytime from the **Supportive Interventions** page to record your before-and-after distress rating."
            )
            return AssistantMessage(role="assistant", content=content, provenance=provenance, citations=citations, tool_calls=tool_calls)

        # Intent 5: Baseline Calibration Requirements
        if any(w in msg_lower for w in ["cold start", "calibrate", "requirement", "how many days", "baseline need"]):
            doc = knowledge_service.get_document_by_id("DOC-COLD-03")
            citations.append(doc["citation"])
            provenance.append("Digital Twin Calibration Standard")

            content = (
                "### Digital Twin Baseline Calibration Requirements\n\n"
                "To ensure medical honesty and avoid fabricating individuality, AnxietyTwin follows strict criteria:\n\n"
                "1. **Cold-Start Phase (<5 observations or <3 distinct days):**\n"
                "   - Your twin uses population reference priors (Resting HR: 72 bpm, HRV: 45 ms, Sleep: 7.5 hrs).\n"
                "2. **Empirical Individual Baseline (>=5 observations across >=3 distinct days):**\n"
                "   - The twin locks in your true personal distribution means and begins computing individual deviations.\n"
                "3. **Personalized ML Lookahead (>=7 distinct days):**\n"
                "   - Requires 7 days to calculate rolling autonomic deviation z-scores for the 24-hour Day-Before-Panic model."
            )
            return AssistantMessage(role="assistant", content=content, provenance=provenance, citations=citations, tool_calls=tool_calls)

        # Intent 6: Simulation Lab vs Real Data
        if any(w in msg_lower for w in ["simulation", "what-if", "what if", "fake", "synthetic", "quarantine"]):
            doc = knowledge_service.get_document_by_id("DOC-SIM-07")
            citations.append(doc["citation"])
            provenance.append("Security & Data Governance Specification")

            content = (
                "### Simulation Lab vs Genuine Baseline Isolation\n\n"
                "AnxietyTwin maintains strict **cryptographic and provenance isolation** between real patient observations and hypothetical simulations:\n\n"
                "- **Simulation Lab:** An interactive what-if sandbox where you can perturb variables (e.g., test 4.5h sleep or 4 cups caffeine) to observe diurnal model reactions.\n"
                "- **Quarantine Guarantee:** All simulated records carry `source_type='simulated'` and are strictly filtered out by the baseline engine. "
                "Experimenting in the lab will never contaminate your genuine clinical baseline or alter production ML scores."
            )
            return AssistantMessage(role="assistant", content=content, provenance=provenance, citations=citations, tool_calls=tool_calls)

        # Intent 7: Default RAG search over knowledge base
        rag_results = knowledge_service.search(user_message, limit=2)
        tool_calls.append({"tool": "query_clinical_knowledge", "result": rag_results})
        provenance.append("Clinical Knowledge Retrieval (RAG)")

        if rag_results:
            top_doc = rag_results[0]
            citations.append(top_doc.get("citation", "AnxietyTwin Knowledge Base"))
            content = (
                f"### {top_doc.get('title')}\n\n"
                f"{top_doc.get('content')}\n\n"
                f"*Source: {top_doc.get('citation')}*\n\n"
                "> You can also ask me about your recent observations, your Composite Stress Index, or request a guided breathing exercise."
            )
        else:
            content = (
                "I am your AnxietyTwin AI Clinical Assistant. I can help you understand your Composite Stress Index (CSI), "
                "explain your baseline calibration status, summarize recent observations, interpret the Day-Before-Panic ML model, "
                "or guide you through evidence-based coping exercises like 4-7-8 breathing or 5-4-3-2-1 grounding.\n\n"
                "How can I assist you with your digital twin today?"
            )

        return AssistantMessage(role="assistant", content=content, provenance=provenance, citations=citations, tool_calls=tool_calls)

    # =========================================================================
    # EXTERNAL LLM PROVIDER ADAPTERS (OpenAI, Gemini, Anthropic, Ollama)
    # =========================================================================

    def _build_system_prompt(self, user_id: int, db: Optional[Session]) -> Tuple[str, List[Dict[str, Any]]]:
        """Builds context-grounded system instructions with authorized patient context."""
        context_parts = []
        tools_ran = []

        if db:
            baseline = AssistantToolRegistry.execute_tool("get_user_baseline", {}, user_id, db)
            tools_ran.append({"tool": "get_user_baseline", "result": baseline})
            context_parts.append(
                f"- Authenticated Baseline: Mode={baseline.get('baseline_mode')}, "
                f"Observations={baseline.get('calibration_progress', {}).get('total_observations', 0)}/5."
            )

            recent = AssistantToolRegistry.execute_tool("get_recent_observations", {"limit": 2}, user_id, db)
            tools_ran.append({"tool": "get_recent_observations", "result": recent})
            if recent.get("recent_physiological"):
                p0 = recent["recent_physiological"][0]
                context_parts.append(f"- Latest Telemetry: HR={p0.get('heart_rate_bpm')} bpm, HRV={p0.get('hrv_ms')} ms.")

        context_summary = "\n".join(context_parts) if context_parts else "No recorded observations yet (cold-start)."

        prompt = (
            "You are the AnxietyTwin AI Clinical Assistant, an evidence-based companion for a personalized "
            "digital twin and anxiety monitoring platform.\n\n"
            "PATIENT CONTEXT (AUTHORIZED READ-ONLY):\n"
            f"{context_summary}\n\n"
            "STRICT OPERATIONAL GUIDELINES:\n"
            "1. NEVER diagnose the patient or prescribe medications. AnxietyTwin is an investigational decision-support prototype.\n"
            "2. Distinguish measured patient telemetry from hypothetical digital-twin simulations.\n"
            "3. The predictive ML target is next-day Day-Before-Panic (DBP) risk at a ~24-hour horizon. It does NOT predict acute panic in the next 1-2 hours.\n"
            "4. If data is insufficient (<5 observations for baseline, <7 days for personalized ML), admit it honestly.\n"
            "5. If the user mentions self-harm or crisis, direct them immediately to the 988 Suicide & Crisis Lifeline (call/text 988).\n"
            "6. Explain calculations transparently (e.g. CSI incorporates Autonomic 35%, Circadian 25%, Mood 20%, Deviation 20%)."
        )
        return prompt, tools_ran

    async def _call_gemini(self, user_message: str, user_id: int, session_id: str, db: Optional[Session]) -> AssistantMessage:
        api_key = os.getenv("GEMINI_API_KEY")
        model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        system_prompt, tool_calls = self._build_system_prompt(user_id, db)

        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_message}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 800},
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            reply_text = data["candidates"][0]["content"]["parts"][0]["text"]

            return AssistantMessage(
                role="assistant",
                content=reply_text,
                provenance=["Google Gemini LLM", "Authenticated Patient Telemetry"],
                citations=["AnxietyTwin Architecture v2.0"],
                tool_calls=tool_calls,
            )

    async def _call_openai(self, user_message: str, user_id: int, session_id: str, db: Optional[Session]) -> AssistantMessage:
        api_key = os.getenv("OPENAI_API_KEY")
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        url = "https://api.openai.com/v1/chat/completions"

        system_prompt, tool_calls = self._build_system_prompt(user_id, db)

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.2,
            "max_tokens": 800,
        }

        headers = {"Authorization": f"Bearer {api_key}"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            reply_text = data["choices"][0]["message"]["content"]

            return AssistantMessage(
                role="assistant",
                content=reply_text,
                provenance=["OpenAI LLM", "Authenticated Patient Telemetry"],
                citations=["AnxietyTwin Architecture v2.0"],
                tool_calls=tool_calls,
            )

    async def _call_anthropic(self, user_message: str, user_id: int, session_id: str, db: Optional[Session]) -> AssistantMessage:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
        url = "https://api.anthropic.com/v1/messages"

        system_prompt, tool_calls = self._build_system_prompt(user_id, db)

        payload = {
            "model": model,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}],
            "max_tokens": 800,
            "temperature": 0.2,
        }
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            reply_text = data["content"][0]["text"]

            return AssistantMessage(
                role="assistant",
                content=reply_text,
                provenance=["Anthropic Claude LLM", "Authenticated Patient Telemetry"],
                citations=["AnxietyTwin Architecture v2.0"],
                tool_calls=tool_calls,
            )

    async def _call_ollama(self, user_message: str, user_id: int, session_id: str, db: Optional[Session]) -> AssistantMessage:
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        model = os.getenv("OLLAMA_MODEL", "llama3.2")
        url = f"{base_url.rstrip('/')}/api/chat"

        system_prompt, tool_calls = self._build_system_prompt(user_id, db)

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            reply_text = data["message"]["content"]

            return AssistantMessage(
                role="assistant",
                content=reply_text,
                provenance=["Local Ollama LLM", "Authenticated Patient Telemetry"],
                citations=["AnxietyTwin Architecture v2.0"],
                tool_calls=tool_calls,
            )


assistant_service = AssistantService()
