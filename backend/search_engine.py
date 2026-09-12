import json

import numpy as np
from sentence_transformers import SentenceTransformer


# =========================================================
# Model
# =========================================================

# Used for semantic retrieval.
embedding_model = SentenceTransformer(
    "all-MiniLM-L6-v2"
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
    embedding,
) -> str:
    """
    Convert a numpy embedding into JSON
    for storage inside SQLite.
    """

    return json.dumps(
        embedding.tolist()
    )


def embedding_from_json(
    value: str,
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