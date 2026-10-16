"""
simulation_report_service.py - Feature 6: Scenario Replay & Comparison Reports
Provides deterministic timeline simulation replay using reproducible pseudo-random seeds,
and professional ReportLab PDF export for side-by-side scenario counterfactuals.
Strictly synthetic: clearly labeled with counterfactual disclaimers.
"""

import io
import math
import random
import hashlib
from typing import Dict, Any, List
from datetime import datetime, timezone

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

from backend.app.models.schemas import (
    SimulationScenarioInput,
    ScenarioReplayRequest,
    ScenarioReplayResponse,
    ScenarioReplayStep,
    ScenarioComparisonResponse,
    ScenarioDifferenceItem,
    ExplainableScenarioComparisonResponse,
    CounterfactualPerturbationRequest,
    CounterfactualPerturbationResponse,
)
from backend.app.services.twin_engine import DigitalTwinEngine


def generate_deterministic_replay(req: ScenarioReplayRequest, profile: Dict[str, Any]) -> ScenarioReplayResponse:
    """
    Generates a deterministic 24-step (or N-step) diurnal timeline trajectory
    given scenario inputs and an explicit random seed.
    Identical seed + input = identical trajectory.
    """
    rng = random.Random(req.seed)
    steps = []

    base_hr = req.scenario_input.heart_rate_bpm
    base_hrv = req.scenario_input.hrv_ms
    caffeine = req.scenario_input.caffeine_cups
    sleep = req.scenario_input.sleep_hours
    anxiety = req.scenario_input.self_reported_anxiety

    for h in range(req.steps_count):
        # Diurnal circadian variation formula:
        # Nocturnal nadir around h=3 (3 AM), morning peak around h=10 (10 AM), secondary peak h=17 (5 PM)
        radian = (2 * math.pi * h) / 24.0
        circadian_hr_shift = math.sin(radian - 1.5) * 6.0
        circadian_hrv_shift = -math.sin(radian - 1.5) * 4.0

        # Caffeine surge around step 8-12 if caffeine > 0
        caffeine_effect = 0.0
        if 8 <= (h % 24) <= 14:
            caffeine_effect = caffeine * 3.0

        # Pseudo-random noise determined strictly by seed
        jitter_hr = rng.uniform(-1.8, 1.8)
        jitter_hrv = rng.uniform(-1.5, 1.5)

        step_hr = max(45.0, round(base_hr + circadian_hr_shift + caffeine_effect + jitter_hr, 1))
        step_hrv = max(10.0, round(base_hrv + circadian_hrv_shift - (caffeine_effect * 0.5) + jitter_hrv, 1))

        # Dynamic twin state computation for this hour
        state = DigitalTwinEngine.compute_twin_state(
            baseline=profile,
            current_hr=step_hr,
            current_hrv=step_hrv,
            current_sleep_hours=sleep,
            current_caffeine_cups=caffeine,
            current_anxiety_score=anxiety,
        )

        steps.append(
            ScenarioReplayStep(
                step_index=h,
                hour_offset=h,
                heart_rate_bpm=step_hr,
                hrv_ms=step_hrv,
                composite_stress_index=state["composite_stress_index"],
                physiological_arousal_score=state["physiological_arousal_score"],
                circadian_disruption_index=state["circadian_disruption_index"],
                state_label=state["state_label"],
            )
        )

    # Compute reproducibility hash
    input_str = f"{req.seed}_{req.scenario_input.model_dump_json()}_{req.steps_count}"
    rep_hash = hashlib.sha256(input_str.encode()).hexdigest()[:16]

    return ScenarioReplayResponse(
        scenario_name="Deterministic Counterfactual Replay",
        seed=req.seed,
        baseline_profile=profile.get("name", "Standard Baseline"),
        steps=steps,
        synthetic_notice="SYNTHETIC DETERMINISTIC REPLAY — NOT GENUINE SENSOR OBSERVATIONS",
        reproducibility_hash=rep_hash,
    )


def generate_scenario_comparison_pdf(
    scenario_a_name: str,
    scenario_b_name: str,
    input_a: SimulationScenarioInput,
    input_b: SimulationScenarioInput,
    profile_name: str,
    comparison: ScenarioComparisonResponse,
) -> bytes:
    """
    Builds a PDF report comparing Scenario A vs Scenario B with
    prominent synthetic counterfactual disclaimers and structured tables.
    """
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
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569"),
        spaceAfter=12,
    )
    section_title = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#0f766e"),
        spaceBefore=10,
        spaceAfter=6,
    )
    disclaimer_style = ParagraphStyle(
        "Disclaimer",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#b91c1c"),
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1e293b"),
    )

    story = []

    # 1. Header
    story.append(Paragraph("AnxietyTwin Research Lab", title_style))
    story.append(
        Paragraph(
            f"Digital Twin Counterfactual Scenario Comparison Report | Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            subtitle_style,
        )
    )
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f766e"), spaceAfter=10))

    # 2. Prominent Synthetic Disclaimer
    disclaimer_text = (
        "<b>WARNING — SYNTHETIC COUNTERFACTUAL EXPERIMENT:</b> "
        "The telemetry, physiological shifts, and twin state scores below are synthetically simulated "
        "for research comparison only. They do NOT reflect genuine patient measurements or clinically validated predictions. "
        "Never use for self-diagnosis or medical treatment decisions."
    )
    disc_table = Table([[Paragraph(disclaimer_text, disclaimer_style)]], colWidths=[540])
    disc_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fef2f2")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#f87171")),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ])
    )
    story.append(disc_table)
    story.append(Spacer(1, 14))

    # 3. Context & Profile
    story.append(Paragraph("1. Simulation Cohort Profile", section_title))
    story.append(
        Paragraph(
            f"<b>Applied Baseline Profile:</b> {profile_name}<br/>"
            f"<b>Comparison Focus:</b> <i>{scenario_a_name}</i> vs <i>{scenario_b_name}</i>",
            body_style,
        )
    )
    story.append(Spacer(1, 10))

    # 4. Input Parameters Side-by-Side Table
    story.append(Paragraph("2. Counterfactual Input Parameters", section_title))
    input_data = [
        ["Parameter", scenario_a_name, scenario_b_name, "Absolute Delta"],
        ["Sleep Duration", f"{input_a.sleep_hours} hrs", f"{input_b.sleep_hours} hrs", f"{round(input_b.sleep_hours - input_a.sleep_hours, 1)} hrs"],
        ["Caffeine Intake", f"{input_a.caffeine_cups} cups", f"{input_b.caffeine_cups} cups", f"{round(input_b.caffeine_cups - input_a.caffeine_cups, 1)} cups"],
        ["Physical Activity", f"{input_a.physical_activity_mins} mins", f"{input_b.physical_activity_mins} mins", f"{round(input_b.physical_activity_mins - input_a.physical_activity_mins, 1)} mins"],
        ["Resting Heart Rate", f"{input_a.heart_rate_bpm} BPM", f"{input_b.heart_rate_bpm} BPM", f"{round(input_b.heart_rate_bpm - input_a.heart_rate_bpm, 1)} BPM"],
        ["Heart Rate Variability", f"{input_a.hrv_ms} ms", f"{input_b.hrv_ms} ms", f"{round(input_b.hrv_ms - input_a.hrv_ms, 1)} ms"],
        ["Subjective Distress", f"{input_a.self_reported_anxiety} / 10", f"{input_b.self_reported_anxiety} / 10", f"{input_b.self_reported_anxiety - input_a.self_reported_anxiety} pts"],
    ]
    t_inputs = Table(input_data, colWidths=[150, 130, 130, 130])
    t_inputs.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(t_inputs)
    story.append(Spacer(1, 12))

    # 5. Output Twin State Side-by-Side Table
    story.append(Paragraph("3. Resulting Digital Twin Indices", section_title))
    state_a = comparison.scenario_a_result
    state_b = comparison.scenario_b_result
    diff = comparison.differential_analysis

    out_data = [
        ["Indicator / Score", scenario_a_name, scenario_b_name, "Divergence Delta"],
        ["State Classification", state_a.get("state_label", "N/A"), state_b.get("state_label", "N/A"), "State Transition"],
        ["Composite Stress Index", f"{state_a.get('composite_stress_index', 0)} / 100", f"{state_b.get('composite_stress_index', 0)} / 100", f"{diff.get('delta_composite_stress', 0):+0.1f}"],
        ["Physiological Arousal", f"{state_a.get('physiological_arousal_score', 0)} / 100", f"{state_b.get('physiological_arousal_score', 0)} / 100", f"{diff.get('delta_physiological_arousal', 0):+0.1f}"],
        ["Circadian Disruption", f"{state_a.get('circadian_disruption_index', 0)} / 100", f"{state_b.get('circadian_disruption_index', 0)} / 100", f"{diff.get('delta_circadian_disruption', 0):+0.1f}"],
    ]

    if comparison.delta_predicted_probability is not None:
        p_a = f"{comparison.scenario_a_prediction.get('predicted_probability', 0)*100:.1f}%" if comparison.scenario_a_prediction else "N/A"
        p_b = f"{comparison.scenario_b_prediction.get('predicted_probability', 0)*100:.1f}%" if comparison.scenario_b_prediction else "N/A"
        out_data.append(["Impending Risk Proxy (XGBoost)", p_a, p_b, f"{comparison.delta_predicted_probability*100:+.1f}%"])

    t_out = Table(out_data, colWidths=[150, 130, 130, 130])
    t_out.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(t_out)
    story.append(Spacer(1, 10))

    # 6. Divergence Driver Explanation
    driver = diff.get("primary_divergence_driver", "Autonomic / Arousal Surge")
    story.append(
        Paragraph(
            f"<b>Primary Divergence Driver:</b> {driver}. "
            "This highlights the mathematical component contributing the greatest relative deviation between the two simulated states.",
            body_style,
        )
    )
    story.append(Spacer(1, 14))

    # 7. Non-Causal Scientific Note
    story.append(Paragraph("4. Scientific & Methodological Transparency", section_title))
    story.append(
        Paragraph(
            "<b>Causality Disclaimer:</b> Model sensitivity to hypothetical counterfactual inputs reflects statistical patterns "
            "derived from population cohorts. It does not establish clinical causation in any individual person. "
            "Adjusting lifestyle factors in this simulation serves an educational and self-reflection purpose only.",
            body_style,
        )
    )

    doc.build(story)
    return buffer.getvalue()


def explain_scenario_differences(
    scenario_a: SimulationScenarioInput,
    scenario_b: SimulationScenarioInput,
    profile: Dict[str, Any],
    comp_res: ScenarioComparisonResponse,
    seed: int = 42,
    engine_version: str = "2.0-adaptive",
) -> ExplainableScenarioComparisonResponse:
    """
    Produces deterministic, grounded mathematical explanations for all differences
    between Scenario A and Scenario B. Identifies which rules fired, attributes changes
    to specific equations, notes unmodeled inputs explicitly, and details scientific limitations.
    """
    param_meta = [
        {
            "key": "sleep_hours",
            "name": "Sleep Duration",
            "unit": "hours",
            "val_a": scenario_a.sleep_hours,
            "val_b": scenario_b.sleep_hours,
            "modeled": True,
            "rule": "Circadian Disruption rule: deficit = max(0, sleep_baseline - sleep) * 20.0 (max 70 pts).",
        },
        {
            "key": "caffeine_cups",
            "name": "Caffeine Intake",
            "unit": "cups",
            "val_a": scenario_a.caffeine_cups,
            "val_b": scenario_b.caffeine_cups,
            "modeled": True,
            "rule": "Circadian Disruption rule: excess = max(0, caffeine - caffeine_baseline) * 12.0 (max 30 pts).",
        },
        {
            "key": "heart_rate_bpm",
            "name": "Resting Heart Rate",
            "unit": "BPM",
            "val_a": scenario_a.heart_rate_bpm,
            "val_b": scenario_b.heart_rate_bpm,
            "modeled": True,
            "rule": "Autonomic Arousal rule: Z_hr = (HR - HR_baseline)/std_hr; HR component = clip(50 + Z_hr*18, 0, 100) with 55% arousal weight.",
        },
        {
            "key": "hrv_ms",
            "name": "Heart Rate Variability (rMSSD)",
            "unit": "ms",
            "val_a": scenario_a.hrv_ms,
            "val_b": scenario_b.hrv_ms,
            "modeled": True,
            "rule": "Autonomic Arousal rule: Z_hrv = (HRV_baseline - HRV)/std_hrv; HRV component = clip(50 + Z_hrv*16, 0, 100) with 45% arousal weight.",
        },
        {
            "key": "self_reported_anxiety",
            "name": "Self-Reported Distress",
            "unit": "rating (0-10)",
            "val_a": scenario_a.self_reported_anxiety,
            "val_b": scenario_b.self_reported_anxiety,
            "modeled": True,
            "rule": "Psychological Strain rule: Anxiety rating * 10.0 (40% weighting in Composite Stress Index).",
        },
        {
            "key": "physical_activity_mins",
            "name": "Physical Activity",
            "unit": "minutes",
            "val_a": scenario_a.physical_activity_mins,
            "val_b": scenario_b.physical_activity_mins,
            "modeled": False,
            "rule": "No modeled effect on DigitalTwinEngine state equations (used only for ML step scaling).",
        },
        {
            "key": "recent_stress_exposure",
            "name": "Recent Stress Exposure",
            "unit": "rating (0-5)",
            "val_a": scenario_a.recent_stress_exposure,
            "val_b": scenario_b.recent_stress_exposure,
            "modeled": False,
            "rule": "No modeled effect on DigitalTwinEngine state equations (used only as ML annoyance proxy).",
        },
    ]

    inputs_changed: List[ScenarioDifferenceItem] = []
    unmodeled_inputs: List[str] = []
    calculation_explanations: List[str] = []

    for p in param_meta:
        diff_val = p["val_b"] - p["val_a"]
        if abs(diff_val) > 1e-4:
            delta_str = f"{'+' if diff_val > 0 else ''}{round(diff_val, 1)} {p['unit']}"
            inputs_changed.append(
                ScenarioDifferenceItem(
                    parameter=p["key"],
                    display_name=p["name"],
                    baseline_val=p["val_a"],
                    alternative_val=p["val_b"],
                    unit=p["unit"],
                    delta_display=delta_str,
                    has_modeled_effect=p["modeled"],
                    effect_explanation=p["rule"],
                )
            )
            if not p["modeled"]:
                unmodeled_inputs.append(
                    f"{p['name']} changed by {delta_str}, but this parameter has NO modeled effect on the DigitalTwinEngine state formula."
                )
            else:
                calculation_explanations.append(
                    f"{p['name']} shifted ({p['val_a']} -> {p['val_b']} {p['unit']}): Governed by {p['rule']}"
                )

    state_a = comp_res.scenario_a_result
    state_b = comp_res.scenario_b_result
    outputs_changed: List[Dict[str, Any]] = [
        {
            "metric": "composite_stress_index",
            "display_name": "Composite Stress Index (CSI)",
            "baseline_value": state_a.get("composite_stress_index"),
            "alternative_value": state_b.get("composite_stress_index"),
            "delta": round(state_b.get("composite_stress_index", 0) - state_a.get("composite_stress_index", 0), 1),
            "unit": "points (0-100)",
            "interpretation": (
                "Composite Stress Index synthesized as 35% Physiological Arousal + 25% Circadian Disruption + 40% Psychological Strain."
            ),
        },
        {
            "metric": "physiological_arousal_score",
            "display_name": "Physiological Arousal Score",
            "baseline_value": state_a.get("physiological_arousal_score"),
            "alternative_value": state_b.get("physiological_arousal_score"),
            "delta": round(state_b.get("physiological_arousal_score", 0) - state_a.get("physiological_arousal_score", 0), 1),
            "unit": "points (0-100)",
            "interpretation": "Calculated from heart rate elevation and parasympathetic HRV suppression.",
        },
        {
            "metric": "circadian_disruption_index",
            "display_name": "Circadian Disruption Index",
            "baseline_value": state_a.get("circadian_disruption_index"),
            "alternative_value": state_b.get("circadian_disruption_index"),
            "delta": round(state_b.get("circadian_disruption_index", 0) - state_a.get("circadian_disruption_index", 0), 1),
            "unit": "points (0-100)",
            "interpretation": "Calculated from acute sleep duration deficit and excess caffeine consumption.",
        },
        {
            "metric": "baseline_deviation_score",
            "display_name": "Baseline Deviation Score",
            "baseline_value": state_a.get("baseline_deviation_score"),
            "alternative_value": state_b.get("baseline_deviation_score"),
            "delta": round(state_b.get("baseline_deviation_score", 0) - state_a.get("baseline_deviation_score", 0), 1),
            "unit": "points (-100 to +100)",
            "interpretation": "Normalized departure of current composite state from reference personal baseline.",
        },
        {
            "metric": "state_label",
            "display_name": "Twin State Classification",
            "baseline_value": state_a.get("state_label"),
            "alternative_value": state_b.get("state_label"),
            "delta": 0,
            "unit": "category",
            "interpretation": f"State transitioned from {state_a.get('state_label')} to {state_b.get('state_label')}.",
        },
    ]

    scientific_limitations = [
        "Simulations are deterministic mathematical calculations based on explicit physiological formulas, not an individualized real-world clinical forecast.",
        "A hypothetical reduction in simulated strain or a recovery preset does not guarantee physiological improvement or prevent acute distress in real life.",
        "Model sensitivity reflects associational patterns and does not establish medical causation.",
        "Inputs not modeled in the core state equations (such as activity minutes) do not influence physiological strain in this twin version.",
    ]

    hash_material = f"{seed}_{engine_version}_{scenario_a.model_dump_json()}_{scenario_b.model_dump_json()}"
    reproducibility_hash = hashlib.sha256(hash_material.encode()).hexdigest()[:16]

    return ExplainableScenarioComparisonResponse(
        scenario_a_result=state_a,
        scenario_b_result=state_b,
        differential_analysis=comp_res.differential_analysis,
        scenario_a_prediction=comp_res.scenario_a_prediction,
        scenario_b_prediction=comp_res.scenario_b_prediction,
        delta_predicted_probability=comp_res.delta_predicted_probability,
        inputs_changed=inputs_changed,
        outputs_changed=outputs_changed,
        unmodeled_inputs=unmodeled_inputs,
        calculation_explanations=calculation_explanations,
        scientific_limitations=scientific_limitations,
        reproducibility_hash=reproducibility_hash,
        engine_version=engine_version,
    )


def run_counterfactual_analysis(
    req: CounterfactualPerturbationRequest,
    profile: Dict[str, Any],
) -> CounterfactualPerturbationResponse:
    """
    Performs a controlled counterfactual analysis where exactly ONE variable is perturbed
    while holding all other scenario inputs identical. Returns exact contribution deltas
    and formula attribution.
    """
    base_dict = req.base_scenario.model_dump()
    orig_val = float(base_dict.get(req.parameter_to_vary, 0.0))
    alt_val = float(req.perturbed_value)
    input_delta = round(alt_val - orig_val, 2)

    alt_dict = dict(base_dict)
    if req.parameter_to_vary == "self_reported_anxiety":
        alt_dict[req.parameter_to_vary] = int(alt_val)
    elif req.parameter_to_vary == "recent_stress_exposure":
        alt_dict[req.parameter_to_vary] = int(alt_val)
    else:
        alt_dict[req.parameter_to_vary] = alt_val

    alt_scenario = SimulationScenarioInput(**alt_dict)

    base_state = DigitalTwinEngine.compute_twin_state(
        baseline=profile,
        current_hr=req.base_scenario.heart_rate_bpm,
        current_hrv=req.base_scenario.hrv_ms,
        current_sleep_hours=req.base_scenario.sleep_hours,
        current_caffeine_cups=req.base_scenario.caffeine_cups,
        current_anxiety_score=req.base_scenario.self_reported_anxiety,
    )

    alt_state = DigitalTwinEngine.compute_twin_state(
        baseline=profile,
        current_hr=alt_scenario.heart_rate_bpm,
        current_hrv=alt_scenario.hrv_ms,
        current_sleep_hours=alt_scenario.sleep_hours,
        current_caffeine_cups=alt_scenario.caffeine_cups,
        current_anxiety_score=alt_scenario.self_reported_anxiety,
    )

    delta_csi = round(alt_state["composite_stress_index"] - base_state["composite_stress_index"], 2)
    delta_arousal = round(alt_state["physiological_arousal_score"] - base_state["physiological_arousal_score"], 2)
    delta_circadian = round(alt_state["circadian_disruption_index"] - base_state["circadian_disruption_index"], 2)
    delta_dev = round(alt_state["baseline_deviation_score"] - base_state["baseline_deviation_score"], 2)

    metric_deltas = {
        "delta_composite_stress": delta_csi,
        "delta_physiological_arousal": delta_arousal,
        "delta_circadian_disruption": delta_circadian,
        "delta_baseline_deviation": delta_dev,
    }

    rule_explanation = ""
    formula_attribution = ""
    unmodeled_note = None

    if req.parameter_to_vary == "sleep_hours":
        base_sleep = profile.get("mean_sleep_hours", 7.5)
        rule_explanation = (
            f"Sleep duration modified from {orig_val}h to {alt_val}h (baseline: {base_sleep}h). "
            f"Sleep deficit penalty formula: max(0, {base_sleep} - sleep) * 20.0 (capped at 70 points)."
        )
        formula_attribution = (
            f"Circadian disruption changed by {delta_circadian:+} pts (25% CSI weight -> {delta_circadian * 0.25:+.2f} CSI shift). "
            f"Total CSI shifted by {delta_csi:+} pts."
        )
    elif req.parameter_to_vary == "caffeine_cups":
        base_caff = profile.get("mean_caffeine_cups", 1.0)
        rule_explanation = (
            f"Caffeine modified from {orig_val} to {alt_val} cups (baseline: {base_caff} cups). "
            f"Caffeine excess penalty formula: max(0, cups - {base_caff}) * 12.0 (capped at 30 points)."
        )
        formula_attribution = (
            f"Circadian disruption changed by {delta_circadian:+} pts (25% CSI weight -> {delta_circadian * 0.25:+.2f} CSI shift). "
            f"Total CSI shifted by {delta_csi:+} pts."
        )
    elif req.parameter_to_vary == "heart_rate_bpm":
        base_hr = profile.get("mean_resting_hr", 70.0)
        std_hr = profile.get("std_resting_hr", 8.0)
        rule_explanation = (
            f"Heart rate modified from {orig_val} BPM to {alt_val} BPM (baseline: {base_hr} BPM, std: {std_hr}). "
            f"Normalized Z_hr = ({alt_val} - {base_hr}) / {std_hr}; HR component = clip(50 + Z_hr * 18, 0, 100)."
        )
        formula_attribution = (
            f"Physiological arousal shifted by {delta_arousal:+} pts (55% HR weighting in arousal, 35% arousal weighting in CSI). "
            f"Total CSI shifted by {delta_csi:+} pts."
        )
    elif req.parameter_to_vary == "hrv_ms":
        base_hrv = profile.get("mean_hrv_ms", 45.0)
        std_hrv = profile.get("std_hrv_ms", 12.0)
        rule_explanation = (
            f"HRV modified from {orig_val} ms to {alt_val} ms (baseline: {base_hrv} ms, std: {std_hrv}). "
            f"Normalized Z_hrv = ({base_hrv} - {alt_val}) / {std_hrv}; HRV component = clip(50 + Z_hrv * 16, 0, 100)."
        )
        formula_attribution = (
            f"Physiological arousal shifted by {delta_arousal:+} pts (45% HRV weighting in arousal, 35% arousal weighting in CSI). "
            f"Total CSI shifted by {delta_csi:+} pts."
        )
    elif req.parameter_to_vary == "self_reported_anxiety":
        rule_explanation = (
            f"Subjective anxiety modified from {int(orig_val)}/10 to {int(alt_val)}/10. "
            f"Psychological strain formula: score * 10.0 (40% weighting in CSI)."
        )
        formula_attribution = (
            f"Psychological strain delta: {(alt_val - orig_val) * 10:+.1f} pts. "
            f"40% weighting in CSI produced direct CSI shift of {delta_csi:+} pts."
        )
    else:
        unmodeled_note = (
            f"Parameter '{req.parameter_to_vary}' is not a variable in the deterministic DigitalTwinEngine physiological formula. "
            "It modifies downstream ML features (such as activity/annoyance proxies) but produces zero change in CSI or physiological arousal."
        )
        rule_explanation = f"Input '{req.parameter_to_vary}' was adjusted from {orig_val} to {alt_val}."
        formula_attribution = "Zero modeled effect on twin state equations (CSI delta: 0.0)."

    return CounterfactualPerturbationResponse(
        parameter_varied=req.parameter_to_vary,
        original_input=orig_val,
        alternative_input=alt_val,
        input_delta=input_delta,
        base_state=base_state,
        counterfactual_state=alt_state,
        metric_deltas=metric_deltas,
        simulation_rule_explanation=rule_explanation,
        formula_attribution=formula_attribution,
        unmodeled_effect_note=unmodeled_note,
    )
