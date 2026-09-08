from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import shutil
import sqlite3
import uuid


app = FastAPI(
    title="Exam Search API",
    version="0.1.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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

        connection.commit()


create_tables()


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

        connection.commit()

    return {
        "message": "Paper uploaded successfully",
        "id": paper_id,
        "module": module,
        "year": year,
        "exam": exam,
        "filename": file.filename
    }