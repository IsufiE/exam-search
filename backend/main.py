from pathlib import Path
import re
import shutil
import sqlite3
import uuid

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from pdf_parser import extract_text_from_pdf
from question_parser import split_into_questions
from search_engine import (
    embed_text,
    embedding_to_json,
    embedding_from_json,
    cosine_similarity,
)


# =========================================================
# App
# =========================================================

app = FastAPI(
    title="Exam Search API",
    version="0.1.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Paths
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

STORAGE_DIR = BASE_DIR / "storage"
DATABASE_PATH = BASE_DIR / "papers.db"

STORAGE_DIR.mkdir(exist_ok=True)


# =========================================================
# Database
# =========================================================

def get_database():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row

    return connection


def create_tables():
    with get_database() as connection:

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS papers (
                id TEXT PRIMARY KEY,
                module TEXT NOT NULL,
                year INTEGER NOT NULL,
                exam TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS main_questions (
                id TEXT PRIMARY KEY,
                paper_id TEXT NOT NULL,
                question_number TEXT NOT NULL,

                FOREIGN KEY (paper_id)
                    REFERENCES papers(id)
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS sub_questions (
                id TEXT PRIMARY KEY,
                main_question_id TEXT NOT NULL,
                label TEXT NOT NULL,
                text TEXT NOT NULL,
                embedding TEXT,
                page_number INTEGER,

                FOREIGN KEY (main_question_id)
                    REFERENCES main_questions(id)
            )
            """
        )

        # -------------------------------------------------
        # Migrations for older databases
        # -------------------------------------------------

        columns = connection.execute(
            "PRAGMA table_info(sub_questions)"
        ).fetchall()

        column_names = [
            column["name"]
            for column in columns
        ]

        if "embedding" not in column_names:
            connection.execute(
                """
                ALTER TABLE sub_questions
                ADD COLUMN embedding TEXT
                """
            )

        if "page_number" not in column_names:
            connection.execute(
                """
                ALTER TABLE sub_questions
                ADD COLUMN page_number INTEGER
                """
            )

        connection.commit()


create_tables()


# =========================================================
# Search helpers
# =========================================================

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "briefly",
    "by",
    "can",
    "compare",
    "contrast",
    "describe",
    "discuss",
    "do",
    "does",
    "explain",
    "for",
    "from",
    "give",
    "how",
    "in",
    "into",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "outline",
    "show",
    "that",
    "the",
    "their",
    "this",
    "to",
    "use",
    "using",
    "was",
    "were",
    "what",
    "when",
    "where",
    "which",
    "why",
    "with",
    "would",
    "you",
    "your",
}


def tokenize_search_text(text: str) -> set[str]:
    """
    Extract useful search terms.

    This is generic and works across modules.

    Examples it can preserve:

        word2vec
        tcp/ip
        mpi
        cnn
        q-learning
        pageRank
        svm
        openmp
    """

    tokens = re.findall(
        r"[A-Za-z0-9][A-Za-z0-9+\-*/.]*",
        text.lower()
    )

    return {
        token
        for token in tokens
        if (
            len(token) > 1
            and token not in STOP_WORDS
        )
    }


def keyword_similarity(
    query: str,
    question: str
) -> float:
    """
    Calculate how many meaningful query terms
    also appear in the exam question.

    Returns 0.0 - 1.0.
    """

    query_tokens = tokenize_search_text(
        query
    )

    question_tokens = tokenize_search_text(
        question
    )

    if not query_tokens:
        return 0.0

    overlap = query_tokens.intersection(
        question_tokens
    )

    return (
        len(overlap)
        /
        len(query_tokens)
    )


def hybrid_score(
    semantic_score: float,
    keyword_score: float
) -> float:
    """
    Semantic meaning remains the most important signal.

    80% semantic similarity
    20% keyword overlap
    """

    return (
        semantic_score * 0.80
        +
        keyword_score * 0.20
    )


# =========================================================
# Other helpers
# =========================================================

def find_question_page(
    full_text: str,
    question_text: str
) -> int | None:

    question_position = full_text.find(
        question_text
    )

    if question_position == -1:

        question_prefix = question_text[:100]

        question_position = full_text.find(
            question_prefix
        )

    if question_position == -1:
        return None

    text_before_question = full_text[
        :question_position
    ]

    page_matches = list(
        re.finditer(
            r"--- PAGE (\d+) ---",
            text_before_question
        )
    )

    if not page_matches:
        return 1

    return int(
        page_matches[-1].group(1)
    )


def format_question_number(
    question_number: str,
    label: str
) -> str:

    if label:
        return (
            f"{question_number}({label})"
        )

    return question_number


# =========================================================
# Request models
# =========================================================

class SearchRequest(BaseModel):
    query: str
    module: str

    year: int | None = None
    exam: str | None = None

    limit: int = 10

    # Threshold applies to semantic similarity,
    # not the hybrid score.
    min_score: float = 0.35


# =========================================================
# Basic routes
# =========================================================

@app.get("/")
def root():
    return {
        "message":
            "Exam Search API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


# =========================================================
# Papers
# =========================================================

@app.get("/papers")
def get_papers():

    with get_database() as connection:

        rows = connection.execute(
            """
            SELECT
                id,
                module,
                year,
                exam,
                original_filename

            FROM papers

            ORDER BY
                module ASC,
                year DESC,
                exam ASC
            """
        ).fetchall()

    return [
        dict(row)
        for row in rows
    ]


# =========================================================
# PDF file
# =========================================================

@app.get("/papers/{paper_id}/file")
def get_paper_file(
    paper_id: str
):

    with get_database() as connection:

        paper = connection.execute(
            """
            SELECT
                original_filename,
                stored_filename

            FROM papers

            WHERE id = ?
            """,
            (paper_id,)
        ).fetchone()

    if paper is None:

        raise HTTPException(
            status_code=404,
            detail="Paper not found"
        )

    pdf_path = (
        STORAGE_DIR
        /
        paper["stored_filename"]
    )

    if not pdf_path.exists():

        raise HTTPException(
            status_code=404,
            detail="PDF file not found"
        )

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=paper[
            "original_filename"
        ],
        content_disposition_type="inline",
    )


# =========================================================
# Paper questions
# =========================================================

@app.get(
    "/papers/{paper_id}/questions"
)
def get_paper_questions(
    paper_id: str
):

    with get_database() as connection:

        main_rows = connection.execute(
            """
            SELECT
                id,
                question_number

            FROM main_questions

            WHERE paper_id = ?

            ORDER BY
                CAST(
                    question_number
                    AS INTEGER
                )
            """,
            (paper_id,)
        ).fetchall()

        result = []

        for main_row in main_rows:

            sub_rows = connection.execute(
                """
                SELECT
                    id,
                    label,
                    text,
                    page_number

                FROM sub_questions

                WHERE main_question_id = ?

                ORDER BY label
                """,
                (
                    main_row["id"],
                )
            ).fetchall()

            result.append(
                {
                    "question_number":
                        main_row[
                            "question_number"
                        ],

                    "sub_questions": [
                        dict(row)
                        for row in sub_rows
                    ],
                }
            )

    return result


# =========================================================
# Upload paper
# =========================================================

@app.post("/papers")
async def upload_paper(
    module: str = Form(...),
    year: int = Form(...),
    exam: str = Form(...),
    file: UploadFile = File(...)
):

    # -----------------------------------------------------
    # Validate
    # -----------------------------------------------------

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="File must have a filename"
        )

    if not file.filename.lower().endswith(
        ".pdf"
    ):

        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )

    normalized_module = (
        module
        .strip()
        .upper()
    )

    normalized_exam = (
        exam.strip()
    )

    normalized_filename = (
        file.filename.strip()
    )

    # -----------------------------------------------------
    # Duplicate protection
    # -----------------------------------------------------

    with get_database() as connection:

        existing_paper = connection.execute(
            """
            SELECT id

            FROM papers

            WHERE module = ?
              AND year = ?
              AND exam = ?
              AND original_filename = ?
            """,
            (
                normalized_module,
                year,
                normalized_exam,
                normalized_filename,
            )
        ).fetchone()

    if existing_paper:

        raise HTTPException(
            status_code=409,
            detail=
                "This paper has already been uploaded"
        )

    # -----------------------------------------------------
    # Save PDF
    # -----------------------------------------------------

    paper_id = str(
        uuid.uuid4()
    )

    stored_filename = (
        f"{paper_id}.pdf"
    )

    destination = (
        STORAGE_DIR
        /
        stored_filename
    )

    with destination.open(
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )

    # -----------------------------------------------------
    # Extract + parse
    # -----------------------------------------------------

    try:

        full_text = extract_text_from_pdf(
            destination
        )

        parsed_questions = (
            split_into_questions(
                full_text
            )
        )

        if not parsed_questions:

            destination.unlink(
                missing_ok=True
            )

            raise HTTPException(
                status_code=422,
                detail=
                    "No exam questions could be detected in this PDF"
            )

    except HTTPException:
        raise

    except Exception as error:

        destination.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=500,
            detail=
                f"Could not parse PDF: {error}"
        )

    # -----------------------------------------------------
    # Store everything
    # -----------------------------------------------------

    with get_database() as connection:

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
                paper_id,
                normalized_module,
                year,
                normalized_exam,
                normalized_filename,
                stored_filename,
            )
        )

        total_sub_questions = 0

        for question in parsed_questions:

            main_question_id = str(
                uuid.uuid4()
            )

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
                    main_question_id,
                    paper_id,
                    question[
                        "question_number"
                    ],
                )
            )

            for sub_question in question[
                "sub_questions"
            ]:

                sub_question_id = str(
                    uuid.uuid4()
                )

                question_text = (
                    sub_question[
                        "text"
                    ]
                )

                label = (
                    sub_question.get(
                        "label",
                        ""
                    )
                )

                # -----------------------------------------
                # Embedding
                # -----------------------------------------

                embedding = embed_text(
                    question_text
                )

                embedding_json = (
                    embedding_to_json(
                        embedding
                    )
                )

                # -----------------------------------------
                # Page
                # -----------------------------------------

                page_number = (
                    find_question_page(
                        full_text,
                        question_text
                    )
                )

                # -----------------------------------------
                # Store question
                # -----------------------------------------

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
                        sub_question_id,
                        main_question_id,
                        label,
                        question_text,
                        embedding_json,
                        page_number,
                    )
                )

                total_sub_questions += 1

        connection.commit()

    return {
        "message":
            "Paper uploaded and parsed successfully",

        "id":
            paper_id,

        "module":
            normalized_module,

        "year":
            year,

        "exam":
            normalized_exam,

        "filename":
            normalized_filename,

        "main_questions_found":
            len(parsed_questions),

        "sub_questions_found":
            total_sub_questions,
    }


# =========================================================
# Delete paper
# =========================================================

@app.delete("/papers/{paper_id}")
def delete_paper(
    paper_id: str
):

    with get_database() as connection:

        paper = connection.execute(
            """
            SELECT stored_filename

            FROM papers

            WHERE id = ?
            """,
            (paper_id,)
        ).fetchone()

        if paper is None:

            raise HTTPException(
                status_code=404,
                detail="Paper not found"
            )

        main_questions = (
            connection.execute(
                """
                SELECT id

                FROM main_questions

                WHERE paper_id = ?
                """,
                (paper_id,)
            ).fetchall()
        )

        for main_question in main_questions:

            connection.execute(
                """
                DELETE FROM sub_questions

                WHERE main_question_id = ?
                """,
                (
                    main_question["id"],
                )
            )

        connection.execute(
            """
            DELETE FROM main_questions

            WHERE paper_id = ?
            """,
            (paper_id,)
        )

        connection.execute(
            """
            DELETE FROM papers

            WHERE id = ?
            """,
            (paper_id,)
        )

        connection.commit()

    pdf_path = (
        STORAGE_DIR
        /
        paper["stored_filename"]
    )

    if pdf_path.exists():
        pdf_path.unlink()

    return {
        "message":
            "Paper deleted successfully",

        "id":
            paper_id,
    }


# =========================================================
# Embedding backfill
# =========================================================

@app.post("/backfill-embeddings")
def backfill_embeddings():

    with get_database() as connection:

        rows = connection.execute(
            """
            SELECT
                id,
                text

            FROM sub_questions

            WHERE embedding IS NULL
               OR embedding = ''
            """
        ).fetchall()

        updated = 0

        for row in rows:

            embedding = embed_text(
                row["text"]
            )

            embedding_json = (
                embedding_to_json(
                    embedding
                )
            )

            connection.execute(
                """
                UPDATE sub_questions

                SET embedding = ?

                WHERE id = ?
                """,
                (
                    embedding_json,
                    row["id"],
                )
            )

            updated += 1

        connection.commit()

    return {
        "message":
            "Embedding backfill complete",

        "updated":
            updated,
    }


# =========================================================
# Page backfill
# =========================================================

@app.post("/backfill-pages")
def backfill_pages():

    with get_database() as connection:

        papers = connection.execute(
            """
            SELECT
                id,
                stored_filename

            FROM papers
            """
        ).fetchall()

        updated = 0

        for paper in papers:

            pdf_path = (
                STORAGE_DIR
                /
                paper[
                    "stored_filename"
                ]
            )

            if not pdf_path.exists():
                continue

            full_text = (
                extract_text_from_pdf(
                    pdf_path
                )
            )

            rows = connection.execute(
                """
                SELECT
                    sq.id,
                    sq.text

                FROM sub_questions sq

                JOIN main_questions mq
                    ON sq.main_question_id =
                       mq.id

                WHERE mq.paper_id = ?
                  AND sq.page_number IS NULL
                """,
                (
                    paper["id"],
                )
            ).fetchall()

            for row in rows:

                page_number = (
                    find_question_page(
                        full_text,
                        row["text"]
                    )
                )

                connection.execute(
                    """
                    UPDATE sub_questions

                    SET page_number = ?

                    WHERE id = ?
                    """,
                    (
                        page_number,
                        row["id"],
                    )
                )

                updated += 1

        connection.commit()

    return {
        "message":
            "Page-number backfill complete",

        "updated":
            updated,
    }


# =========================================================
# Hybrid semantic search
# =========================================================

@app.post("/search")
def search_questions(
    request: SearchRequest
):

    # -----------------------------------------------------
    # Validate
    # -----------------------------------------------------

    if not request.query.strip():

        raise HTTPException(
            status_code=400,
            detail=
                "Search query cannot be empty"
        )

    if not request.module.strip():

        raise HTTPException(
            status_code=400,
            detail="Module is required"
        )

    if request.limit < 1:

        raise HTTPException(
            status_code=400,
            detail=
                "Search limit must be at least 1"
        )

    normalized_module = (
        request.module
        .strip()
        .upper()
    )

    normalized_exam = (
        request.exam.strip()
        if request.exam
        else None
    )

    # -----------------------------------------------------
    # Query embedding
    # -----------------------------------------------------

    query_embedding = embed_text(
        request.query
    )

    # -----------------------------------------------------
    # Fetch only the selected module
    # -----------------------------------------------------

    sql_query = """
        SELECT
            sq.id,
            sq.label,
            sq.text,
            sq.embedding,
            sq.page_number,

            mq.question_number,

            p.id AS paper_id,
            p.module,
            p.year,
            p.exam

        FROM sub_questions sq

        JOIN main_questions mq
            ON sq.main_question_id =
               mq.id

        JOIN papers p
            ON mq.paper_id =
               p.id

        WHERE p.module = ?
    """

    params = [
        normalized_module
    ]

    # -----------------------------------------------------
    # Optional year
    # -----------------------------------------------------

    if request.year is not None:

        sql_query += (
            " AND p.year = ?"
        )

        params.append(
            request.year
        )

    # -----------------------------------------------------
    # Optional exam session
    # -----------------------------------------------------

    if normalized_exam:

        sql_query += (
            " AND p.exam = ?"
        )

        params.append(
            normalized_exam
        )

    with get_database() as connection:

        rows = connection.execute(
            sql_query,
            params
        ).fetchall()

    # -----------------------------------------------------
    # Rank results
    # -----------------------------------------------------

    results = []

    for row in rows:

        # ---------------------------------------------
        # Stored embedding
        # ---------------------------------------------

        if row["embedding"]:

            question_embedding = (
                embedding_from_json(
                    row["embedding"]
                )
            )

        else:

            # Backward compatibility
            question_embedding = (
                embed_text(
                    row["text"]
                )
            )

        # ---------------------------------------------
        # Semantic similarity
        # ---------------------------------------------

        semantic_score = (
            cosine_similarity(
                query_embedding,
                question_embedding
            )
        )

        # ---------------------------------------------
        # Ignore semantically weak questions
        # ---------------------------------------------

        if (
            semantic_score
            <
            request.min_score
        ):
            continue

        # ---------------------------------------------
        # Keyword relevance
        # ---------------------------------------------

        keyword_score = (
            keyword_similarity(
                request.query,
                row["text"]
            )
        )

        # ---------------------------------------------
        # Final hybrid score
        # ---------------------------------------------

        score = hybrid_score(
            semantic_score,
            keyword_score
        )

        display_question_number = (
            format_question_number(
                row[
                    "question_number"
                ],
                row["label"]
            )
        )

        results.append(
            {
                "id":
                    row["id"],

                "paper_id":
                    row["paper_id"],

                "module":
                    row["module"],

                "year":
                    row["year"],

                "exam":
                    row["exam"],

                "question_number":
                    display_question_number,

                "page_number":
                    row["page_number"],

                "text":
                    row["text"],

                # This is what the frontend
                # currently displays.
                "score":
                    score,

                # Useful while evaluating search.
                "semantic_score":
                    semantic_score,

                "keyword_score":
                    keyword_score,
            }
        )

    # -----------------------------------------------------
    # Highest hybrid score first
    # -----------------------------------------------------

    results.sort(
        key=lambda item:
            item["score"],
        reverse=True
    )

    return results[
        :request.limit
    ]