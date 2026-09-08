from pathlib import Path
import shutil
import sqlite3
import uuid

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from pdf_parser import extract_text_from_pdf
from question_parser import split_into_questions
from search_engine import (
    embed_text,
    embedding_to_json,
    embedding_from_json,
    cosine_similarity,
)


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


# -------------------------
# Paths
# -------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

STORAGE_DIR = BASE_DIR / "storage"
DATABASE_PATH = BASE_DIR / "papers.db"

STORAGE_DIR.mkdir(exist_ok=True)


# -------------------------
# Database
# -------------------------

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
                FOREIGN KEY (paper_id) REFERENCES papers(id)
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
                FOREIGN KEY (main_question_id)
                    REFERENCES main_questions(id)
            )
            """
        )

        # Migration for databases created before the embedding column existed
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

        connection.commit()


create_tables()


# -------------------------
# Request Models
# -------------------------

class SearchRequest(BaseModel):
    query: str
    limit: int = 5


# -------------------------
# Routes
# -------------------------

@app.get("/")
def root():
    return {
        "message": "Exam Search API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


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
            ORDER BY year DESC
            """
        ).fetchall()

    return [dict(row) for row in rows]


@app.get("/papers/{paper_id}/questions")
def get_paper_questions(paper_id: str):
    with get_database() as connection:

        main_rows = connection.execute(
            """
            SELECT
                id,
                question_number
            FROM main_questions
            WHERE paper_id = ?
            ORDER BY CAST(question_number AS INTEGER)
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
                    text
                FROM sub_questions
                WHERE main_question_id = ?
                ORDER BY label
                """,
                (main_row["id"],)
            ).fetchall()

            result.append(
                {
                    "question_number": main_row["question_number"],
                    "sub_questions": [
                        dict(row)
                        for row in sub_rows
                    ]
                }
            )

    return result


@app.post("/papers")
async def upload_paper(
    module: str = Form(...),
    year: int = Form(...),
    exam: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="File must have a filename"
        )

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )

    paper_id = str(uuid.uuid4())
    stored_filename = f"{paper_id}.pdf"
    destination = STORAGE_DIR / stored_filename

    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        text = extract_text_from_pdf(destination)
        parsed_questions = split_into_questions(text)

    except Exception as error:
        destination.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail=f"Could not parse PDF: {error}"
        )

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
                module,
                year,
                exam,
                file.filename,
                stored_filename
            )
        )

        total_sub_questions = 0

        for question in parsed_questions:

            main_question_id = str(uuid.uuid4())

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
                    question["question_number"]
                )
            )

            for sub_question in question["sub_questions"]:

                sub_question_id = str(uuid.uuid4())

                embedding = embed_text(
                    sub_question["text"]
                )

                embedding_json = embedding_to_json(
                    embedding
                )

                connection.execute(
                    """
                    INSERT INTO sub_questions (
                        id,
                        main_question_id,
                        label,
                        text,
                        embedding
                    )
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        sub_question_id,
                        main_question_id,
                        sub_question["label"],
                        sub_question["text"],
                        embedding_json
                    )
                )

                total_sub_questions += 1

        connection.commit()

    return {
        "message": "Paper uploaded and parsed successfully",
        "id": paper_id,
        "module": module,
        "year": year,
        "exam": exam,
        "filename": file.filename,
        "main_questions_found": len(parsed_questions),
        "sub_questions_found": total_sub_questions
    }


@app.delete("/papers/{paper_id}")
def delete_paper(paper_id: str):
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

        main_questions = connection.execute(
            """
            SELECT id
            FROM main_questions
            WHERE paper_id = ?
            """,
            (paper_id,)
        ).fetchall()

        for main_question in main_questions:
            connection.execute(
                """
                DELETE FROM sub_questions
                WHERE main_question_id = ?
                """,
                (main_question["id"],)
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

    pdf_path = STORAGE_DIR / paper["stored_filename"]

    if pdf_path.exists():
        pdf_path.unlink()

    return {
        "message": "Paper deleted successfully",
        "id": paper_id
    }





@app.post("/backfill-embeddings")
def backfill_embeddings():
    with get_database() as connection:

        rows = connection.execute(
            """
            SELECT id, text
            FROM sub_questions
            WHERE embedding IS NULL
               OR embedding = ''
            """
        ).fetchall()

        updated = 0

        for row in rows:
            embedding = embed_text(row["text"])
            embedding_json = embedding_to_json(embedding)

            connection.execute(
                """
                UPDATE sub_questions
                SET embedding = ?
                WHERE id = ?
                """,
                (
                    embedding_json,
                    row["id"]
                )
            )

            updated += 1

        connection.commit()

    return {
        "message": "Embedding backfill complete",
        "updated": updated
    }








@app.post("/search")
def search_questions(request: SearchRequest):
    if not request.query.strip():
        raise HTTPException(
            status_code=400,
            detail="Search query cannot be empty"
        )

    query_embedding = embed_text(request.query)

    with get_database() as connection:

        rows = connection.execute(
            """
            SELECT
                sq.id,
                sq.label,
                sq.text,
                sq.embedding,
                mq.question_number,
                p.module,
                p.year,
                p.exam
            FROM sub_questions sq
            JOIN main_questions mq
                ON sq.main_question_id = mq.id
            JOIN papers p
                ON mq.paper_id = p.id
            """
        ).fetchall()

    results = []

    for row in rows:

        if row["embedding"]:
            question_embedding = embedding_from_json(
                row["embedding"]
            )
        else:
            # Backward compatibility for old rows
            question_embedding = embed_text(
                row["text"]
            )

        score = cosine_similarity(
            query_embedding,
            question_embedding
        )

        results.append(
            {
                "id": row["id"],
                "module": row["module"],
                "year": row["year"],
                "exam": row["exam"],
                "question_number":
                    f"{row['question_number']}({row['label']})",
                "text": row["text"],
                "score": score,
            }
        )

    results.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    return results[:request.limit]