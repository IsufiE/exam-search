import re
from collections import Counter

from search_engine import cosine_similarity
from trend_engine import analyse_topics


QUESTION_STYLES = {
    "Calculate or derive": r"calculate|compute|estimate|derive|solve",
    "Explain or describe": r"explain|describe|outline|discuss",
    "Compare methods": r"compare|contrast|distinguish",
    "Define or identify": r"define|identify|name|list|state",
    "Interpret results": r"interpret|analyse|analyze",
    "Draw or design": r"draw|sketch|design|illustrate",
}
STYLE_PATTERN = re.compile(
    r"\b(" + "|".join(QUESTION_STYLES.values()) + r")\b", re.IGNORECASE
)


def recurring_styles(questions):
    years_by_style = {style: set() for style in QUESTION_STYLES}
    for question in questions:
        match = STYLE_PATTERN.search(question["text"])
        if match:
            for style, verbs in QUESTION_STYLES.items():
                if match.group().lower() in verbs.split("|"):
                    years_by_style[style].add(question["year"])
                    break
    return [
        {"label": style, "years": sorted(years)}
        for style, years in years_by_style.items()
        if len(years) >= 2
    ]


def topic_signals(topic, years, target_year):
    seen = sorted(set(topic["years"]))
    history = set(years)
    gaps = [later - earlier for earlier, later in zip(seen, seen[1:])]
    # A missing paper inside the pattern cannot establish an absence.
    cycle = (
        gaps[0]
        if len(gaps) >= 2
        and len(set(gaps)) == 1
        and gaps[0] > 1
        and all(year in history for year in range(seen[0], seen[-1] + 1))
        else None
    )
    cycle_due = (
        cycle is not None
        and target_year - seen[-1] == cycle
        and all(year in history for year in range(seen[-1] + 1, target_year))
    )

    recent, earlier = years[-2:], years[:-2]
    shift = 0
    if len(earlier) >= 2:
        recent_count = len(set(recent).intersection(seen))
        earlier_rate = len(set(earlier).intersection(seen)) / len(earlier)
        if recent_count == 2 and earlier_rate <= 0.5:
            shift = 1
        elif recent_count == 0 and earlier_rate >= 0.5:
            shift = -1
    return cycle, cycle_due, shift


def rank_topics(topics, years, target_year, signal):
    rows = []
    for topic in topics:
        cycle, cycle_due, shift = topic_signals(topic, years, target_year)
        frequency = (len(topic["years"]) + 1) / (len(years) + 2)
        adjustment = 0
        if signal == "cycle" and cycle_due:
            adjustment = 0.15
        if signal == "shift":
            adjustment = 0.15 * shift

        rows.append({
            **topic,
            "estimate": round(max(0.01, min(0.99, frequency + adjustment)), 4),
            "cycle_years": cycle,
            "cycle_due": cycle_due,
            "recent_shift": shift,
        })
    return sorted(rows, key=lambda topic: (-topic["estimate"], -topic["question_count"]))


def forecast_topics(questions, topics, target_year, minimum_years, similarity_threshold):
    years = sorted({question["year"] for question in questions})
    by_year = {
        year: [question for question in questions if question["year"] == year]
        for year in years
    }
    embeddings = {question["id"]: question["embedding"] for question in questions}
    methods = ("frequency", "cycle", "shift")
    hits = Counter()
    slots = 0
    folds = 0

    for index, held_out in enumerate(years[3:], start=3):
        earlier = years[:index]
        training = [question for year in earlier for question in by_year[year]]
        candidates = analyse_topics(
            training,
            minimum_years=minimum_years,
            similarity_threshold=similarity_threshold,
        )
        if not candidates:
            continue

        # Compare the unseen questions against examples from training topics.
        appeared = {
            topic["id"]
            for topic in candidates
            if any(
                cosine_similarity(embeddings[example["id"]], question["embedding"])
                >= similarity_threshold
                for example in topic["questions"]
                for question in by_year[held_out]
            )
        }
        folds += 1
        slots += min(5, len(candidates))
        for method in methods:
            ranked = rank_topics(candidates, earlier, held_out, method)
            hits[method] += sum(topic["id"] in appeared for topic in ranked[:5])

    winner = max(methods, key=hits.__getitem__) if folds >= 3 else "frequency"
    ranked = rank_topics(topics, years, target_year, winner)
    recent_years = years[-4:]
    consecutive = len(recent_years) == 4 and recent_years[-1] - recent_years[0] == 3
    for topic in ranked:
        topic["styles"] = recurring_styles(topic["questions"])
        topic["alternates_with"] = None
        if consecutive:
            present = set(recent_years).intersection(topic["years"])
            odd_positions = set(recent_years[::2])
            even_positions = set(recent_years[1::2])
            if present in (odd_positions, even_positions):
                opposite = set(recent_years) - present
                topic["alternates_with"] = next(
                    (other["topic"] for other in ranked
                     if other["id"] != topic["id"]
                     and set(recent_years).intersection(other["years"]) == opposite),
                    None,
                )

    return ranked, {
        "method": winner,
        "exams_tested": folds,
        "topics_tested": slots,
        "baseline_hits": hits["frequency"],
        "selected_hits": hits[winner],
    }
