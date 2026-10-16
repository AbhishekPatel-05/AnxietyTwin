"""
AnxietyTwin - Verified Clinical & Platform Knowledge Service
Provides structured, evidence-grounded clinical knowledge articles and
in-memory RAG retrieval with explicit source attribution and citations.
"""

from typing import List, Dict, Any, Optional
import re


class KnowledgeDocument:
    def __init__(self, doc_id: str, title: str, category: str, content: str, citation: str, tags: List[str]):
        self.doc_id = doc_id
        self.title = title
        self.category = category
        self.content = content
        self.citation = citation
        self.tags = tags

    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "title": self.title,
            "category": self.category,
            "content": self.content,
            "citation": self.citation,
            "tags": self.tags,
        }


CLINICAL_KNOWLEDGE_BASE: List[KnowledgeDocument] = [
    KnowledgeDocument(
        doc_id="DOC-CSI-01",
        title="Composite Stress Index (CSI) Mathematical Formulation",
        category="platform_architecture",
        content=(
            "The Composite Stress Index (CSI) is a continuous score from 0 to 100 representing multi-modal autonomic "
            "and psychological load. It is computed from four weighted orthogonal components: "
            "1. Autonomic Arousal (35% weight): calculated from resting heart rate elevation and HRV RMSSD depression. "
            "2. Circadian Disruption Index (25% weight): calculated from sleep duration deficits (<7 hours) and caffeine excess (>2 cups). "
            "3. Subjective Anxiety Rating (20% weight): normalized self-reported distress score (0-10 scale). "
            "4. Baseline Departure (20% weight): absolute deviation of current physiological metrics from the user's personal baseline. "
            "Tiers: 0-30 Stable Baseline, 30-50 Mild Strain, 50-70 Elevated Arousal, 70-100 High Vulnerability."
        ),
        citation="AnxietyTwin Architecture Specification v2.0; McEwen BS, 'Neurobiology of stress and adaptation', Dialogues Clin Neurosci, 2006.",
        tags=["csi", "composite stress", "formula", "autonomic arousal", "circadian disruption", "calculation", "metrics"],
    ),
    KnowledgeDocument(
        doc_id="DOC-DBP-02",
        title="Day-Before-Panic (DBP) Research ML Model Target & Limitations",
        category="machine_learning",
        content=(
            "AnxietyTwin's predictive machine learning model targets Day-Before-Panic (DBP) risk estimation at an approximate "
            "24-hour prospective horizon. It is trained on the open research cohort by Jang et al. (Scientific Data 11:1264, 2024), "
            "encompassing 3,969 daily observations across 43 participants with a 6.4% empirical positive label prevalence. "
            "CRITICAL LIMITATION: The model does NOT predict acute, imminent panic attacks in the next few hours. "
            "It estimates prospective vulnerability over the next calendar day to enable preventive self-care. "
            "Predictions are experimental research estimates, not clinical psychiatric diagnoses or guarantees."
        ),
        citation="Jang et al., 'A multimodal wearable and smartphone dataset for panic disorder research', Scientific Data (Nature), 2024.",
        tags=["dbp", "day before panic", "ml model", "prediction", "horizon", "accuracy", "limitations", "nature study"],
    ),
    KnowledgeDocument(
        doc_id="DOC-COLD-03",
        title="Cold-Start Calibration Requirements & Demographic Priors",
        category="data_quality",
        content=(
            "An individual's autonomic tone cannot be assumed without empirical history. "
            "AnxietyTwin enforces strict calibration thresholds: "
            "- Cold-Start Mode: Active when fewer than 5 valid observations across 3 distinct days are recorded. "
            "During cold-start, baseline metrics default to population reference benchmarks (HR: 72 bpm, HRV: 45 ms, Sleep: 7.5 hrs). "
            "- Empirical Personal Baseline: Activated only once at least 5 observations across 3 distinct days are accumulated. "
            "- Personalized ML Z-Scoring: Requires at least 7 distinct days of prior historical observations. "
            "If fewer than 7 days exist, the API returns status 'unavailable' instead of fabricating individualized scores."
        ),
        citation="AnxietyTwin Data Quality & Digital Twin Baseline Specification v2.0.",
        tags=["cold start", "baseline", "calibration", "requirements", "demographic priors", "7 days", "data sufficiency"],
    ),
    KnowledgeDocument(
        doc_id="DOC-COPE-04",
        title="Evidence-Based Coping: 4-7-8 Rhythmic Breathing Mechanics",
        category="interventions",
        content=(
            "The 4-7-8 breathing technique is an evidence-based autonomic down-regulation exercise rooted in pranayama physiology. "
            "Protocol: Inhale quietly through the nose for 4 seconds, gently hold breath for 7 seconds, and exhale completely "
            "through pursed lips for 8 seconds. Repeat for 4 consecutive cycles. "
            "Mechanics: Prolonging the expiratory phase relative to inspiration increases intrathoracic pressure, triggering the "
            "baroreflex to stimulate vagal nerve acetylcholine release, slowing sinus heart rate and increasing HRV RMSSD."
        ),
        citation="Weil A., 'Breathing: The Master Key to Self-Healing', 2010; Laborde S. et al., 'Slow-paced breathing and autonomic regulation', Front Psychol, 2017.",
        tags=["breathing", "4-7-8", "vagus nerve", "hrv", "coping", "calming exercise", "heart rate reduction"],
    ),
    KnowledgeDocument(
        doc_id="DOC-COPE-05",
        title="Evidence-Based Coping: 5-4-3-2-1 Sensory Grounding",
        category="interventions",
        content=(
            "The 5-4-3-2-1 sensory grounding exercise is a structured Cognitive Behavioral Therapy (CBT) somatic mindfulness technique. "
            "Steps: Identify 5 things you can see, 4 things you can physically touch/feel, 3 distinct sounds you can hear, "
            "2 things you can smell, and 1 positive thing you can taste or feel grateful for. "
            "Mechanics: Forces attentional shift from internal catastrophic ruminations and amygdala hyper-arousal to external sensory "
            "inputs processed by the prefrontal cortex, interrupting somatic panic escalation loops."
        ),
        citation="Linehan MM, 'DBT Skills Training Manual', Guilford Press, 2014; Najavits LM, 'Seeking Safety', 2002.",
        tags=["grounding", "5-4-3-2-1", "mindfulness", "somatic", "panic loop", "sensory", "distress"],
    ),
    KnowledgeDocument(
        doc_id="DOC-SLEEP-06",
        title="Circadian Regularity & Sleep Hygiene Guidelines",
        category="lifestyle",
        content=(
            "Circadian disruption is one of the strongest predictive antecedents of impending anxiety spikes. "
            "Key principles: "
            "1. Consistent Wake Time: Fix morning wake time within ±30 minutes 7 days a week to anchor the central suprachiasmatic nucleus. "
            "2. Caffeine Half-Life: Caffeine has an average metabolic half-life of 5 to 7 hours. Intake after 2:00 PM significantly impairs "
            "slow-wave deep sleep and suppresses overnight parasympathetic recovery. "
            "3. Sleep Duration: Sleeping less than 6 hours elevates baseline sympathetic tone and increases amygdala reactivity by up to 60%."
        ),
        citation="Walker MP, 'Why We Sleep', Scribner, 2017; Yoo SS et al., 'The human emotional brain without sleep', Curr Biol, 2007.",
        tags=["sleep", "caffeine", "circadian", "wake time", "sleep hygiene", "deep sleep", "night"],
    ),
    KnowledgeDocument(
        doc_id="DOC-SIM-07",
        title="Simulation Lab vs Genuine Clinical Baseline Quarantine",
        category="platform_architecture",
        content=(
            "AnxietyTwin maintains strict cryptographic and architectural isolation between hypothetical digital-twin simulations "
            "and genuine personal health records. "
            "All simulated scenario snapshots are explicitly tagged with source_type='simulated' or 'synthetic'. "
            "The DigitalTwinEngine strictly rejects non-genuine records from calculating real patient baselines, ensuring what-if "
            "explorations in the Simulation Lab cannot silently contaminate a patient's true medical history or ML features."
        ),
        citation="AnxietyTwin Security & Data Governance Protocol v2.0.",
        tags=["simulation", "what if", "quarantine", "synthetic", "genuine baseline", "isolation", "privacy"],
    ),
    KnowledgeDocument(
        doc_id="DOC-CRISIS-08",
        title="Safety Guardrail & Emergency Crisis Escalation Protocol",
        category="safety",
        content=(
            "AnxietyTwin is an investigational healthcare technology platform and digital twin research assistant. "
            "It is NOT an emergency response system, licensed therapist, suicide intervention service, or clinical diagnostic tool. "
            "If a user expresses immediate self-harm, suicidal intent, severe hopelessness, or medical emergency: "
            "- Immediate Referral: Free, confidential 24/7 crisis support is available. "
            "- United States & Canada: Call or text 988 (Suicide & Crisis Lifeline). Text HOME to 741741 (Crisis Text Line). "
            "- United Kingdom: Call 111 (NHS Mental Health) or text SHOUT to 85258. "
            "- European Union: Call 112. "
            "- Global Directory: Visit findahelpline.com for international support."
        ),
        citation="National Suicide Prevention Lifeline (988 Lifeline Policy); IASP Global Crisis Resources.",
        tags=["crisis", "emergency", "suicide", "988", "hotline", "self-harm", "help", "danger"],
    ),
]


class KnowledgeService:
    def __init__(self, documents: List[KnowledgeDocument] = CLINICAL_KNOWLEDGE_BASE):
        self.documents = documents

    def search(self, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        """
        Retrieves top relevant clinical knowledge documents using keyword overlap
        and category matching with confidence scoring and citations.
        """
        query_tokens = set(re.findall(r"\w+", query.lower()))
        if not query_tokens:
            return [doc.to_dict() for doc in self.documents[:limit]]

        scored_docs = []
        for doc in self.documents:
            score = 0.0
            doc_text = (doc.title + " " + doc.content + " " + " ".join(doc.tags)).lower()
            doc_tokens = set(re.findall(r"\w+", doc_text))

            # Overlap score
            intersection = query_tokens.intersection(doc_tokens)
            score += len(intersection) * 2.0

            # Tag match bonus
            for tag in doc.tags:
                if tag in query.lower():
                    score += 3.0

            # Title match bonus
            if any(token in doc.title.lower() for token in query_tokens):
                score += 2.5

            if score > 0:
                scored_docs.append((score, doc))

        # Sort descending by score
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        results = [doc.to_dict() for _, doc in scored_docs[:limit]]
        if not results:
            # Fallback to top general platform docs
            results = [doc.to_dict() for doc in self.documents[:limit]]
        return results

    def get_document_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        for doc in self.documents:
            if doc.doc_id == doc_id:
                return doc.to_dict()
        return None


knowledge_service = KnowledgeService()
