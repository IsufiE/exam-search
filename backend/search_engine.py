from sentence_transformers import SentenceTransformer
import numpy as np
import json


model = SentenceTransformer("all-MiniLM-L6-v2")


def embed_text(text: str):
    return model.encode(
        text,
        normalize_embeddings=True
    )


def embedding_to_json(embedding):
    return json.dumps(embedding.tolist())


def embedding_from_json(embedding_json: str):
    return np.array(
        json.loads(embedding_json),
        dtype=np.float32
    )


def cosine_similarity(vector_a, vector_b):
    return float(np.dot(vector_a, vector_b))