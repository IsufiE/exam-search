from sentence_transformers import SentenceTransformer
import numpy as np


model = SentenceTransformer("all-MiniLM-L6-v2")


def embed_text(text: str):
    return model.encode(text, normalize_embeddings=True)


def cosine_similarity(vector_a, vector_b):
    return float(np.dot(vector_a, vector_b))