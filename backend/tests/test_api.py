import sqlite3

import numpy as np

import main


# =========================================================
# Basic API
# =========================================================

def test_root_endpoint(
    client,
):
    response = client.get(
        "/"
    )

    assert response.status_code == 200

    assert response.json() == {
        "message":
            "Exam Search API is running"
    }


def test_health_endpoint(
    client,
):
    response = client.get(
        "/health"
    )

    assert response.status_code == 200

    assert response.json() == {
        "status": "ok"
    }


# =========================================================
# Papers
# =========================================================

def test_get_papers_returns_metadata(
    client,
    seed_questions,
):
    seed_questions()

    response = client.get(
        "/papers"
    )

    assert response.status_code == 200

    papers = response.json()

    assert len(papers) == 2

    assert papers[0][
        "module"
    ] == "TEST100"

    assert papers[0][
        "year"
    ] == 2025

    assert papers[1][
        "year"
    ] == 2024

    assert (
        "stored_filename"
        not in papers[0]
    )


def test_empty_paper_library_returns_empty_list(
    client,
):
    response = client.get(
        "/papers"
    )

    assert response.status_code == 200

    assert response.json() == []


# =========================================================
# Paper questions
# =========================================================

def test_get_paper_questions(
    client,
    seed_questions,
):
    seed_questions()

    response = client.get(
        "/papers/paper-new/questions"
    )

    assert response.status_code == 200

    questions = response.json()

    assert len(questions) == 2

    assert (
        questions[0][
            "question_number"
        ]
        ==
        "1"
    )

    first_subquestion = (
        questions[0][
            "sub_questions"
        ][0]
    )

    assert (
        first_subquestion[
            "label"
        ]
        ==
        "a"
    )

    assert (
        first_subquestion[
            "page_number"
        ]
        ==
        2
    )


def test_question_api_cleans_page_noise_but_keeps_marks(
    client,
    seed_questions,
):
    seed_questions()

    response = client.get(
        "/papers/paper-new/questions"
    )

    assert response.status_code == 200

    question_text = (
        response.json()[0][
            "sub_questions"
        ][0]["text"]
    )

    assert (
        "Page 2/4"
        not in question_text
    )

    assert (
        "[5 marks]"
        in question_text
    )


# =========================================================
# Search
# =========================================================

def test_search_returns_ranked_results(
    client,
    seed_questions,
    monkeypatch,
):
    seed_questions()

    monkeypatch.setattr(
        main,
        "embed_text",
        lambda text:
            np.array(
                [1.0, 0.0]
            ),
    )

    response = client.post(
        "/search",
        json={
            "query":
                (
                    "semantic search "
                    "vector representations"
                ),

            "module":
                "test100",

            "limit":
                10,

            "min_score":
                0.0,
        },
    )

    assert response.status_code == 200

    results = response.json()

    assert len(results) == 3

    assert (
        results[0][
            "module"
        ]
        ==
        "TEST100"
    )

    assert (
        results[0][
            "score"
        ]
        >=
        results[1][
            "score"
        ]
    )

    assert (
        results[1][
            "score"
        ]
        >=
        results[2][
            "score"
        ]
    )


def test_search_respects_module_filter(
    client,
    seed_questions,
    monkeypatch,
):
    seed_questions(
        module="TEST100"
    )

    monkeypatch.setattr(
        main,
        "embed_text",
        lambda text:
            np.array(
                [1.0, 0.0]
            ),
    )

    response = client.post(
        "/search",
        json={
            "query":
                "semantic search",

            "module":
                "OTHER200",

            "min_score":
                0.0,
        },
    )

    assert response.status_code == 200

    assert response.json() == []


def test_search_rejects_empty_query(
    client,
):
    response = client.post(
        "/search",
        json={
            "query":
                "   ",

            "module":
                "TEST100",
        },
    )

    assert response.status_code == 400

    assert (
        response.json()[
            "detail"
        ]
        ==
        "Search query cannot be empty"
    )


def test_search_rejects_empty_module(
    client,
):
    response = client.post(
        "/search",
        json={
            "query":
                "example query",

            "module":
                "   ",
        },
    )

    assert response.status_code == 400

    assert (
        response.json()[
            "detail"
        ]
        ==
        "Module is required"
    )


def test_search_rejects_invalid_limit(
    client,
):
    response = client.post(
        "/search",
        json={
            "query":
                "example query",

            "module":
                "TEST100",

            "limit":
                0,
        },
    )

    assert response.status_code == 400


# =========================================================
# Trends
# =========================================================

def test_trends_endpoint_returns_analysis(
    client,
    seed_questions,
    monkeypatch,
):
    seed_questions()

    expected_topics = [
        {
            "id":
                1,

            "name":
                "Semantic Retrieval",

            "appearance_count":
                2,

            "question_count":
                2,

            "years":
                [2025, 2024],

            "cohesion":
                0.95,

            "questions":
                [],
        }
    ]

    monkeypatch.setattr(
        main,
        "analyse_topics",
        lambda questions,
               minimum_years,
               similarity_threshold:
            expected_topics,
    )

    response = client.get(
        "/trends/test100"
    )

    assert response.status_code == 200

    data = response.json()

    assert (
        data["module"]
        ==
        "TEST100"
    )

    assert (
        data["years_analysed"]
        ==
        2
    )

    assert (
        data["questions_analysed"]
        ==
        3
    )

    assert (
        data["topic_count"]
        ==
        1
    )

    assert (
        data["topics"]
        ==
        expected_topics
    )


def test_trends_unknown_module_returns_404(
    client,
):
    response = client.get(
        "/trends/UNKNOWN100"
    )

    assert response.status_code == 404


def test_trends_rejects_invalid_minimum_years(
    client,
):
    response = client.get(
        (
            "/trends/TEST100"
            "?minimum_years=0"
        )
    )

    assert response.status_code == 400


def test_trends_rejects_invalid_similarity_threshold(
    client,
):
    response = client.get(
        (
            "/trends/TEST100"
            "?similarity_threshold=1.5"
        )
    )

    assert response.status_code == 400


# =========================================================
# Similar / repeated questions
# =========================================================

def test_repeated_questions_detects_cross_year_match(
    client,
    seed_questions,
):
    seed_questions()

    response = client.get(
        (
            "/repeated-questions/TEST100"
            "?similarity_threshold=0.90"
        )
    )

    assert response.status_code == 200

    data = response.json()

    assert (
        data["module"]
        ==
        "TEST100"
    )

    assert (
        data[
            "questions_analysed"
        ]
        ==
        3
    )

    assert (
        data[
            "different_years_only"
        ]
        is True
    )

    assert (
        data[
            "match_count"
        ]
        >=
        1
    )

    first_match = (
        data["matches"][0]
    )

    assert (
        first_match[
            "similarity"
        ]
        >=
        0.90
    )

    assert (
        first_match[
            "question"
        ]["year"]
        >=
        first_match[
            "similar_question"
        ]["year"]
    )


def test_repeated_questions_unknown_module_returns_404(
    client,
):
    response = client.get(
        "/repeated-questions/UNKNOWN100"
    )

    assert response.status_code == 404


def test_repeated_questions_rejects_invalid_limit(
    client,
):
    response = client.get(
        (
            "/repeated-questions/TEST100"
            "?limit=0"
        )
    )

    assert response.status_code == 400


def test_repeated_questions_rejects_limit_over_100(
    client,
):
    response = client.get(
        (
            "/repeated-questions/TEST100"
            "?limit=101"
        )
    )

    assert response.status_code == 400


def test_repeated_questions_rejects_invalid_threshold(
    client,
):
    response = client.get(
        (
            "/repeated-questions/TEST100"
            "?similarity_threshold=0"
        )
    )

    assert response.status_code == 400


# =========================================================
# Upload
# =========================================================

def test_upload_rejects_non_pdf(
    client,
):
    response = client.post(
        "/papers",
        data={
            "module":
                "TEST100",

            "year":
                "2025",

            "exam":
                "Spring",
        },
        files={
            "file": (
                "paper.txt",
                b"not a pdf",
                "text/plain",
            )
        },
    )

    assert response.status_code == 400

    assert (
        response.json()[
            "detail"
        ]
        ==
        "Only PDF files are allowed"
    )


def test_upload_normalises_module_and_stores_questions(
    client,
    test_environment,
    monkeypatch,
):
    fake_pdf_text = """
--- PAGE 1 ---

1 (a) Explain the first concept.
[5 marks]

1 (b) Describe the second concept.
[5 marks]
"""

    fake_parsed_questions = [
        {
            "question_number":
                "1",

            "sub_questions": [
                {
                    "label":
                        "a",

                    "text":
                        (
                            "1 (a) Explain "
                            "the first concept."
                        ),
                },
                {
                    "label":
                        "b",

                    "text":
                        (
                            "1 (b) Describe "
                            "the second concept."
                        ),
                },
            ],
        }
    ]

    monkeypatch.setattr(
        main,
        "extract_text_from_pdf",
        lambda path:
            fake_pdf_text,
    )

    monkeypatch.setattr(
        main,
        "split_into_questions",
        lambda text:
            fake_parsed_questions,
    )

    monkeypatch.setattr(
        main,
        "embed_text",
        lambda text:
            np.array(
                [1.0, 0.0]
            ),
    )

    response = client.post(
        "/papers",
        data={
            "module":
                " test100 ",

            "year":
                "2025",

            "exam":
                "Spring",
        },
        files={
            "file": (
                "example.pdf",
                b"%PDF-test-content",
                "application/pdf",
            )
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert (
        data["module"]
        ==
        "TEST100"
    )

    assert (
        data[
            "main_questions_found"
        ]
        ==
        1
    )

    assert (
        data[
            "sub_questions_found"
        ]
        ==
        2
    )

    assert (
        data["filename"]
        ==
        "example.pdf"
    )

    database_path = (
        test_environment[
            "database_path"
        ]
    )

    connection = sqlite3.connect(
        database_path
    )

    try:

        paper_count = (
            connection.execute(
                "SELECT COUNT(*) FROM papers"
            ).fetchone()[0]
        )

        question_count = (
            connection.execute(
                """
                SELECT COUNT(*)
                FROM sub_questions
                """
            ).fetchone()[0]
        )

    finally:
        connection.close()

    assert paper_count == 1
    assert question_count == 2


def test_duplicate_upload_is_rejected(
    client,
    seed_questions,
):
    seed_questions()

    response = client.post(
        "/papers",
        data={
            "module":
                "TEST100",

            "year":
                "2025",

            "exam":
                "Spring",
        },
        files={
            "file": (
                "paper-new.pdf",
                b"%PDF-test",
                "application/pdf",
            )
        },
    )

    assert response.status_code == 409


# =========================================================
# Delete
# =========================================================

def test_delete_paper_removes_related_database_records(
    client,
    seed_questions,
    test_environment,
):
    seed_questions()

    storage_dir = (
        test_environment[
            "storage_dir"
        ]
    )

    pdf_path = (
        storage_dir
        /
        "paper-new.pdf"
    )

    pdf_path.write_bytes(
        b"%PDF-test"
    )

    response = client.delete(
        "/papers/paper-new"
    )

    assert response.status_code == 200

    assert (
        response.json()[
            "id"
        ]
        ==
        "paper-new"
    )

    database_path = (
        test_environment[
            "database_path"
        ]
    )

    connection = sqlite3.connect(
        database_path
    )

    try:

        paper_count = (
            connection.execute(
                """
                SELECT COUNT(*)
                FROM papers
                WHERE id = 'paper-new'
                """
            ).fetchone()[0]
        )

        main_count = (
            connection.execute(
                """
                SELECT COUNT(*)
                FROM main_questions
                WHERE paper_id = 'paper-new'
                """
            ).fetchone()[0]
        )

        orphan_subquestion_count = (
            connection.execute(
                """
                SELECT COUNT(*)

                FROM sub_questions sq

                JOIN main_questions mq
                    ON sq.main_question_id =
                       mq.id

                WHERE mq.paper_id =
                      'paper-new'
                """
            ).fetchone()[0]
        )

    finally:
        connection.close()

    assert paper_count == 0
    assert main_count == 0

    assert (
        orphan_subquestion_count
        ==
        0
    )

    assert (
        not pdf_path.exists()
    )


def test_delete_unknown_paper_returns_404(
    client,
):
    response = client.delete(
        "/papers/does-not-exist"
    )

    assert response.status_code == 404