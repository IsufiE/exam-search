from forecast_engine import forecast_topics, recurring_styles, topic_signals


def test_regular_cycle_requires_coverage_and_checks_target_year():
    topic = {"years": [2018, 2021, 2024]}
    years = list(range(2018, 2027))
    assert topic_signals(topic, years, 2027)[:2] == (3, True)
    assert topic_signals(topic, [year for year in years if year != 2020], 2027)[:2] == (None, False)
    assert topic_signals(topic, years, 2028)[:2] == (3, False)


def test_style_and_recent_shift_use_distinct_years():
    questions = [
        {"year": 2024, "text": "Calculate focal length"},
        {"year": 2025, "text": "Compute the focal length"},
        {"year": 2025, "text": "Explain the result"},
    ]
    assert recurring_styles(questions) == [
        {"label": "Calculate or derive", "years": [2024, 2025]},
    ]
    assert topic_signals({"years": [2024, 2025]}, [2022, 2023, 2024, 2025], 2026)[2] == 1


def test_alternation_is_descriptive_with_too_few_backtests(monkeypatch):
    monkeypatch.setattr("forecast_engine.analyse_topics", lambda *args, **kwargs: [])
    questions = [{"year": year, "id": str(year), "embedding": [1, 0]} for year in range(2020, 2024)]
    topics = [
        {"id": "a", "topic": "Cameras", "years": [2020, 2022], "question_count": 2, "questions": []},
        {"id": "b", "topic": "Filters", "years": [2021, 2023], "question_count": 2, "questions": []},
    ]
    ranked, backtest = forecast_topics(questions, topics, 2024, 2, 0.62)
    assert backtest["method"] == "frequency"
    assert [topic["alternates_with"] for topic in ranked] == ["Filters", "Cameras"]
