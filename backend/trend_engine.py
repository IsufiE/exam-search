import re
from collections import Counter

import numpy as np


# =========================================================
# Configuration
# =========================================================

TOPIC_SIMILARITY_THRESHOLD = 0.62

MIN_QUESTIONS_PER_TOPIC = 2


# =========================================================
# Generic words that should not become topic labels
# =========================================================

STOP_WORDS = {
    "a",
    "about",
    "above",
    "after",
    "again",
    "against",
    "all",
    "also",
    "am",
    "an",
    "and",
    "any",
    "are",
    "as",
    "at",
    "be",
    "because",
    "been",
    "before",
    "being",
    "below",
    "between",
    "both",
    "briefly",
    "but",
    "by",
    "calculate",
    "can",
    "compare",
    "consider",
    "describe",
    "diagram",
    "did",
    "discuss",
    "do",
    "does",
    "doing",
    "each",
    "example",
    "explain",
    "figure",
    "fig",
    "following",
    "for",
    "from",
    "further",
    "given",
    "give",
    "had",
    "has",
    "have",
    "having",
    "how",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "itself",
    "many",
    "mark",
    "marks",
    "may",
    "more",
    "most",
    "of",
    "on",
    "once",
    "one",
    "only",
    "or",
    "other",
    "our",
    "outline",
    "page",
    "provide",
    "question",
    "result",
    "show",
    "shown",
    "such",
    "than",
    "that",
    "the",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "this",
    "those",
    "three",
    "through",
    "to",
    "two",
    "under",
    "use",
    "used",
    "using",
    "value",
    "values",
    "very",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "which",
    "while",
    "who",
    "why",
    "will",
    "with",
    "would",
    "write",
    "you",
    "your",
}


# =========================================================
# Vector helpers
# =========================================================

def cosine_similarity(
    vector_a,
    vector_b,
) -> float:

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

    return float(
        np.dot(
            vector_a,
            vector_b,
        )
        /
        denominator
    )


def calculate_centroid(
    embeddings,
):

    matrix = np.asarray(
        embeddings,
        dtype=np.float32,
    )

    centroid = np.mean(
        matrix,
        axis=0,
    )

    norm = np.linalg.norm(
        centroid
    )

    if norm > 0:
        centroid = (
            centroid
            /
            norm
        )

    return centroid


# =========================================================
# Text cleaning
# =========================================================

def clean_question_text(
    text: str,
) -> str:
    """
    Remove PDF/page presentation noise while preserving
    actual exam-question content.

    Importantly, mark information such as:

        [5 marks]
        [25 marks]

    is deliberately kept.

    The raw text stored in SQLite is not modified. This
    cleaner is only used for labels and API presentation.
    """

    if not text:
        return ""

    cleaned = text.replace(
        "\r\n",
        "\n"
    ).replace(
        "\r",
        "\n"
    )

    # -----------------------------------------------------
    # Internal page markers inserted by the PDF parser
    # -----------------------------------------------------

    cleaned = re.sub(
        r"(?im)^\s*---\s*PAGE\s+\d+\s*---\s*$",
        "",
        cleaned,
    )

    # -----------------------------------------------------
    # University footer/header lines
    #
    # This also removes common extraction corruption before
    # the copyright symbol, e.g. ¬©Maynooth University.
    # -----------------------------------------------------

    cleaned = re.sub(
        r"(?im)^.*maynooth\s+university.*$",
        "",
        cleaned,
    )

    # -----------------------------------------------------
    # Page-number footer lines:
    #
    # Page 4/14
    # Page 4 / 14
    # -----------------------------------------------------

    cleaned = re.sub(
        r"(?im)^\s*page\s+\d+\s*/\s*\d+\s*$",
        "",
        cleaned,
    )

    # -----------------------------------------------------
    # Standalone module-code footer/header lines.
    #
    # Examples:
    #
    # CS410
    # CS404
    # MA123
    #
    # Only a standalone line is removed. A module code
    # occurring inside genuine question text is preserved.
    # -----------------------------------------------------

    cleaned = re.sub(
        r"(?im)^\s*[A-Za-z]{2,}\d{2,}\s*$",
        "",
        cleaned,
    )

    # -----------------------------------------------------
    # Standalone exam-session/date footer lines.
    #
    # Examples:
    #
    # January 2026
    # May 2025
    # August 2024
    #
    # This intentionally acts only on a complete line.
    # -----------------------------------------------------

    cleaned = re.sub(
        (
            r"(?im)^\s*"
            r"(january|february|march|april|may|june|"
            r"july|august|september|october|november|december)"
            r"\s+\d{4}\s*$"
        ),
        "",
        cleaned,
    )

    # -----------------------------------------------------
    # Remove lines containing only copyright debris.
    # -----------------------------------------------------

    cleaned = re.sub(
        r"(?im)^\s*[¬©®]+\s*$",
        "",
        cleaned,
    )

    # -----------------------------------------------------
    # Remove trailing spaces on each line
    # -----------------------------------------------------

    cleaned = re.sub(
        r"[ \t]+$",
        "",
        cleaned,
        flags=re.MULTILINE,
    )

    # -----------------------------------------------------
    # Convert excessive spaces/tabs within a line to one
    # space, but keep useful line breaks.
    # -----------------------------------------------------

    cleaned = re.sub(
        r"[ \t]{2,}",
        " ",
        cleaned,
    )

    # -----------------------------------------------------
    # No more than one blank line between text blocks
    # -----------------------------------------------------

    cleaned = re.sub(
        r"\n\s*\n\s*\n+",
        "\n\n",
        cleaned,
    )

    # -----------------------------------------------------
    # Remove blank space at the beginning/end
    # -----------------------------------------------------

    return cleaned.strip()


# =========================================================
# Tokenization
# =========================================================

def tokenize_topic_text(
    text: str,
):

    text = clean_question_text(
        text
    )

    words = re.findall(
        r"\b[A-Za-z][A-Za-z0-9+\-/.]{2,}\b",
        text.lower(),
    )

    cleaned = []

    for word in words:

        word = word.strip(
            ".,;:()[]{}"
        )

        if not word:
            continue

        if word in STOP_WORDS:
            continue

        if word.isdigit():
            continue

        if len(word) < 3:
            continue

        cleaned.append(
            word
        )

    return cleaned


# =========================================================
# Phrase extraction
# =========================================================

def extract_candidate_phrases(
    text: str,
):
    """
    Extract short noun-like phrases from question text.

    This helps us prefer labels such as:

        camera matrix
        kernel density
        loss function
        output vector

    instead of isolated generic words.
    """

    text = clean_question_text(
        text
    )

    tokens = re.findall(
        r"\b[A-Za-z][A-Za-z0-9+\-/.]{2,}\b",
        text.lower(),
    )

    cleaned_tokens = []

    for token in tokens:

        token = token.strip(
            ".,;:()[]{}"
        )

        if (
            token
            and
            token not in STOP_WORDS
            and
            not token.isdigit()
        ):
            cleaned_tokens.append(
                token
            )

    phrases = []

    for size in (3, 2):

        for index in range(
            len(cleaned_tokens)
            -
            size
            +
            1
        ):

            phrase_tokens = (
                cleaned_tokens[
                    index:
                    index + size
                ]
            )

            phrase = " ".join(
                phrase_tokens
            )

            phrases.append(
                phrase
            )

    return phrases


# =========================================================
# Topic label generation
# =========================================================

def format_topic_term(
    term: str,
) -> str:

    known_uppercase = {
        "cnn",
        "cnns",
        "kde",
        "svm",
        "http",
        "tcp",
        "ip",
        "mpi",
        "rgb",
        "hsv",
        "gpu",
        "cpu",
        "pca",
    }

    words = []

    for word in term.split():

        if word.lower() in known_uppercase:

            words.append(
                word.upper()
            )

        else:

            words.append(
                word.title()
            )

    return " ".join(
        words
    )


def generate_topic_label(
    questions,
):
    """
    Generate a topic label using both recurring phrases
    and recurring technical words.
    """

    number_of_questions = len(
        questions
    )

    phrase_frequency = Counter()
    phrase_document_frequency = Counter()

    word_frequency = Counter()
    word_document_frequency = Counter()

    for question in questions:

        text = question["text"]

        words = tokenize_topic_text(
            text
        )

        phrases = extract_candidate_phrases(
            text
        )

        word_frequency.update(
            words
        )

        word_document_frequency.update(
            set(words)
        )

        phrase_frequency.update(
            phrases
        )

        phrase_document_frequency.update(
            set(phrases)
        )

    # -----------------------------------------------------
    # Prefer phrases shared across multiple questions
    # -----------------------------------------------------

    phrase_scores = []

    for (
        phrase,
        frequency,
    ) in phrase_frequency.items():

        documents = (
            phrase_document_frequency[
                phrase
            ]
        )

        if documents < 2:
            continue

        score = (
            documents * 4
            +
            frequency
        )

        phrase_scores.append(
            (
                phrase,
                score,
                documents,
            )
        )

    phrase_scores.sort(
        key=lambda item: (
            item[1],
            item[2],
            len(item[0]),
        ),
        reverse=True,
    )

    selected_terms = []

    used_words = set()

    for (
        phrase,
        _score,
        _documents,
    ) in phrase_scores:

        phrase_words = set(
            phrase.split()
        )

        overlap = (
            phrase_words
            &
            used_words
        )

        if (
            used_words
            and
            len(overlap)
            >=
            len(phrase_words)
        ):
            continue

        selected_terms.append(
            phrase
        )

        used_words.update(
            phrase_words
        )

        if len(selected_terms) == 2:
            break

    # -----------------------------------------------------
    # Fall back to technical words
    # -----------------------------------------------------

    if len(selected_terms) < 2:

        word_scores = []

        for (
            word,
            frequency,
        ) in word_frequency.items():

            documents = (
                word_document_frequency[
                    word
                ]
            )

            if (
                number_of_questions >= 3
                and
                documents < 2
            ):
                continue

            score = (
                documents * 3
                +
                frequency
            )

            word_scores.append(
                (
                    word,
                    score,
                    documents,
                )
            )

        word_scores.sort(
            key=lambda item: (
                item[1],
                item[2],
                len(item[0]),
            ),
            reverse=True,
        )

        for (
            word,
            _score,
            _documents,
        ) in word_scores:

            if word in used_words:
                continue

            selected_terms.append(
                word
            )

            used_words.add(
                word
            )

            if len(selected_terms) == 3:
                break

    if not selected_terms:
        return "Recurring Topic"

    return " / ".join(
        format_topic_term(
            term
        )
        for term
        in selected_terms
    )


# =========================================================
# Topic clustering
# =========================================================

def cluster_questions(
    questions,
    similarity_threshold:
        float = TOPIC_SIMILARITY_THRESHOLD,
):

    clusters = []

    ordered_questions = sorted(
        questions,
        key=lambda item:
            len(
                clean_question_text(
                    item["text"]
                )
            ),
        reverse=True,
    )

    for question in ordered_questions:

        embedding = (
            question[
                "embedding"
            ]
        )

        best_cluster = None
        best_similarity = -1.0

        for cluster in clusters:

            similarity = (
                cosine_similarity(
                    embedding,
                    cluster[
                        "centroid"
                    ],
                )
            )

            if (
                similarity
                >
                best_similarity
            ):

                best_similarity = (
                    similarity
                )

                best_cluster = (
                    cluster
                )

        if (
            best_cluster is not None
            and
            best_similarity
            >=
            similarity_threshold
        ):

            best_cluster[
                "questions"
            ].append(
                question
            )

            best_cluster[
                "embeddings"
            ].append(
                embedding
            )

            best_cluster[
                "centroid"
            ] = (
                calculate_centroid(
                    best_cluster[
                        "embeddings"
                    ]
                )
            )

        else:

            clusters.append(
                {
                    "questions": [
                        question
                    ],

                    "embeddings": [
                        embedding
                    ],

                    "centroid":
                        embedding,
                }
            )

    return clusters


# =========================================================
# Topic quality helpers
# =========================================================

def calculate_cluster_cohesion(
    cluster,
) -> float:
    """
    Measure how closely the questions in a topic
    match the cluster centroid.
    """

    questions = (
        cluster[
            "questions"
        ]
    )

    centroid = (
        cluster[
            "centroid"
        ]
    )

    similarities = []

    for question in questions:

        similarity = cosine_similarity(
            question[
                "embedding"
            ],
            centroid,
        )

        similarities.append(
            similarity
        )

    if not similarities:
        return 0.0

    return float(
        np.mean(
            similarities
        )
    )


# =========================================================
# Trend analysis
# =========================================================

def analyse_topics(
    questions,
    minimum_years: int = 2,
    similarity_threshold:
        float = TOPIC_SIMILARITY_THRESHOLD,
):

    if not questions:
        return []

    clusters = cluster_questions(
        questions,
        similarity_threshold=
            similarity_threshold,
    )

    topics = []

    for cluster in clusters:

        cluster_questions_list = (
            cluster[
                "questions"
            ]
        )

        if (
            len(
                cluster_questions_list
            )
            <
            MIN_QUESTIONS_PER_TOPIC
        ):
            continue

        years = sorted(
            {
                question["year"]
                for question
                in cluster_questions_list
            },
            reverse=True,
        )

        if (
            len(years)
            <
            minimum_years
        ):
            continue

        label = generate_topic_label(
            cluster_questions_list
        )

        cohesion = (
            calculate_cluster_cohesion(
                cluster
            )
        )

        sorted_questions = sorted(
            cluster_questions_list,
            key=lambda item: (
                item["year"],
                item["question_number"],
            ),
            reverse=True,
        )

        topics.append(
            {
                "topic":
                    label,

                "question_count":
                    len(
                        cluster_questions_list
                    ),

                "appearance_count":
                    len(years),

                "years":
                    years,

                "cohesion":
                    round(
                        cohesion,
                        3,
                    ),

                "questions": [
                    {
                        "id":
                            question[
                                "id"
                            ],

                        "paper_id":
                            question[
                                "paper_id"
                            ],

                        "year":
                            question[
                                "year"
                            ],

                        "exam":
                            question[
                                "exam"
                            ],

                        "question_number":
                            question[
                                "question_number"
                            ],

                        "page_number":
                            question[
                                "page_number"
                            ],

                        "text":
                            clean_question_text(
                                question[
                                    "text"
                                ]
                            ),
                    }
                    for question
                    in sorted_questions
                ],
            }
        )

    topics.sort(
        key=lambda topic: (
            topic[
                "appearance_count"
            ],
            topic[
                "question_count"
            ],
            topic[
                "cohesion"
            ],
        ),
        reverse=True,
    )

    for index, topic in enumerate(
        topics,
        start=1,
    ):

        topic[
            "id"
        ] = (
            f"topic-{index}"
        )

    return topics