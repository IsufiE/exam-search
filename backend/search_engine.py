import json

import numpy as np

from sentence_transformers import (
    SentenceTransformer,
    CrossEncoder,
)


# =========================================================
# Models
# =========================================================

# Used for fast semantic retrieval.
embedding_model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)


# Used for second-stage reranking.
#
# This model sees the user's query and the candidate
# exam question together, allowing it to make a stronger
# relevance judgement than embedding similarity alone.
reranker_model = CrossEncoder(
    "cross-encoder/ms-marco-MiniLM-L-6-v2"
)


# =========================================================
# Embeddings
# =========================================================

def embed_text(text: str):
    """
    Convert text into a semantic embedding.
    """

    embedding = embedding_model.encode(
        text,
        normalize_embeddings=True,
    )

    return embedding


# =========================================================
# Embedding storage helpers
# =========================================================

def embedding_to_json(
    embedding
) -> str:
    """
    Convert a numpy embedding into JSON
    for storage inside SQLite.
    """

    return json.dumps(
        embedding.tolist()
    )


def embedding_from_json(
    value: str
):
    """
    Restore an embedding stored in SQLite.
    """

    return np.array(
        json.loads(value),
        dtype=np.float32,
    )


# =========================================================
# Cosine similarity
# =========================================================

def cosine_similarity(
    vector_a,
    vector_b,
) -> float:
    """
    Calculate cosine similarity between two embeddings.
    """

    vector_a = np.asarray(
        vector_a,
        dtype=np.float32,
    )

    vector_b = np.asarray(
        vector_b,
        dtype=np.float32,
    )

    denominator = (
        np.linalg.norm(vector_a)
        *
        np.linalg.norm(vector_b)
    )

    if denominator == 0:
        return 0.0

    similarity = (
        np.dot(
            vector_a,
            vector_b,
        )
        /
        denominator
    )

    return float(
        similarity
    )


# =========================================================
# Cross-encoder reranking
# =========================================================

def rerank_questions(
    query: str,
    question_texts: list[str],
) -> list[float]:
    """
    Compare a query against multiple candidate
    exam questions using the cross-encoder.

    The cross-encoder receives pairs like:

        [
            query,
            exam_question
        ]

    It returns raw logits.

    We convert those raw scores into values between
    0 and 1 using a sigmoid.
    """

    if not question_texts:
        return []

    pairs = [
        [
            query,
            question_text,
        ]
        for question_text
        in question_texts
    ]

    raw_scores = reranker_model.predict(
        pairs,
        show_progress_bar=False,
    )

    raw_scores = np.asarray(
        raw_scores,
        dtype=np.float32,
    ).reshape(-1)

    # Keep sigmoid numerically stable.
    raw_scores = np.clip(
        raw_scores,
        -30,
        30,
    )

    probabilities = (
        1.0
        /
        (
            1.0
            +
            np.exp(
                -raw_scores
            )
        )
    )

    return [
        float(score)
        for score
        in probabilities
    ]