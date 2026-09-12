import sqlite3

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture
def test_environment(
    tmp_path,
    monkeypatch,
):
    """
    Give every API test its own isolated SQLite database
    and storage directory.

    Nothing in the real papers.db or storage/ directory is modified.
    """

    database_path = (
        tmp_path
        /
        "test_papers.db"
    )

    storage_dir = (
        tmp_path
        /
        "storage"
    )

    storage_dir.mkdir()

    monkeypatch.setattr(
        main,
        "DATABASE_PATH",
        database_path,
    )

    monkeypatch.setattr(
        main,
        "STORAGE_DIR",
        storage_dir,
    )

    main.create_tables()

    return {
        "database_path":
            database_path,

        "storage_dir":
            storage_dir,
    }


@pytest.fixture
def client(
    test_environment,
):
    """
    FastAPI test client using the isolated test environment.
    """

    with TestClient(
        main.app
    ) as test_client:
        yield test_client


@pytest.fixture
def seed_questions(
    test_environment,
):
    """
    Helper for inserting generic papers/questions directly
    into the temporary database.

    This avoids depending on real university modules or PDFs.
    """

    database_path = (
        test_environment[
            "database_path"
        ]
    )

    def _seed(
        module="TEST100",
    ):

        papers = [
            {
                "id":
                    "paper-new",

                "module":
                    module,

                "year":
                    2025,

                "exam":
                    "Spring",

                "original_filename":
                    "paper-new.pdf",

                "stored_filename":
                    "paper-new.pdf",
            },
            {
                "id":
                    "paper-old",

                "module":
                    module,

                "year":
                    2024,

                "exam":
                    "Spring",

                "original_filename":
                    "paper-old.pdf",

                "stored_filename":
                    "paper-old.pdf",
            },
        ]

        main_questions = [
            {
                "id":
                    "main-new-1",

                "paper_id":
                    "paper-new",

                "question_number":
                    "1",
            },
            {
                "id":
                    "main-new-2",

                "paper_id":
                    "paper-new",

                "question_number":
                    "2",
            },
            {
                "id":
                    "main-old-1",

                "paper_id":
                    "paper-old",

                "question_number":
                    "1",
            },
        ]

        sub_questions = [
            {
                "id":
                    "sub-new-1",

                "main_question_id":
                    "main-new-1",

                "label":
                    "a",

                "text":
                    (
                        "1 (a) Explain semantic search "
                        "using vector representations.\n"
                        "[5 marks]\n"
                        "Page 2/4"
                    ),

                "embedding":
                    "[1.0, 0.0]",

                "page_number":
                    2,
            },
            {
                "id":
                    "sub-new-2",

                "main_question_id":
                    "main-new-2",

                "label":
                    "a",

                "text":
                    (
                        "2 (a) Discuss database indexing "
                        "and query optimisation.\n"
                        "[5 marks]"
                    ),

                "embedding":
                    "[0.0, 1.0]",

                "page_number":
                    3,
            },
            {
                "id":
                    "sub-old-1",

                "main_question_id":
                    "main-old-1",

                "label":
                    "a",

                "text":
                    (
                        "1 (a) Describe how semantic retrieval "
                        "uses vector representations.\n"
                        "[5 marks]"
                    ),

                "embedding":
                    "[0.99, 0.01]",

                "page_number":
                    2,
            },
        ]

        connection = sqlite3.connect(
            database_path
        )

        try:

            for paper in papers:

                connection.execute(
                    """
                    INSERT INTO papers (
                        id,
                        module,
                        year,
                        exam,
                        original_filename,
                        stored_filename
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        paper["id"],
                        paper["module"],
                        paper["year"],
                        paper["exam"],
                        paper[
                            "original_filename"
                        ],
                        paper[
                            "stored_filename"
                        ],
                    ),
                )

            for question in main_questions:

                connection.execute(
                    """
                    INSERT INTO main_questions (
                        id,
                        paper_id,
                        question_number
                    )
                    VALUES (?, ?, ?)
                    """,
                    (
                        question["id"],
                        question["paper_id"],
                        question[
                            "question_number"
                        ],
                    ),
                )

            for question in sub_questions:

                connection.execute(
                    """
                    INSERT INTO sub_questions (
                        id,
                        main_question_id,
                        label,
                        text,
                        embedding,
                        page_number
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        question["id"],
                        question[
                            "main_question_id"
                        ],
                        question["label"],
                        question["text"],
                        question["embedding"],
                        question[
                            "page_number"
                        ],
                    ),
                )

            connection.commit()

        finally:
            connection.close()

        return {
            "module":
                module,

            "papers":
                papers,

            "main_questions":
                main_questions,

            "sub_questions":
                sub_questions,
        }

    return _seed