import re


def split_into_questions(text: str):
    """
    Split exam text into main questions and sub-questions.

    Supports formats such as:

        1 (a)
        (b)

        1(a)
        (b)

        1. a)
        b)

    Returns:

    [
        {
            "question_number": "1",
            "sub_questions": [
                {
                    "label": "a",
                    "text": "..."
                }
            ]
        }
    ]
    """

    text = text.replace("\r", "\n")

    pattern = re.compile(
        r"""
        ^\s*
        (?:
            # Style A:
            # 1 (a)
            # 1(a)
            # (b)
            (?:(\d+)\s*\.?\s*)?
            \(([a-e])\)

            |

            # Style B:
            # 1. a)
            # b)
            (?:(\d+)\s*\.\s*)?
            ([a-e])\)
        )
        """,
        re.MULTILINE | re.VERBOSE,
    )

    matches = list(pattern.finditer(text))

    grouped_questions = []
    current_question = None

    for index, match in enumerate(matches):
        main_number = (
            match.group(1)
            or match.group(3)
        )

        label = (
            match.group(2)
            or match.group(4)
        )

        if main_number is not None:
            current_question = {
                "question_number": main_number,
                "sub_questions": [],
            }

            grouped_questions.append(
                current_question
            )

        if current_question is None:
            continue

        start = match.start()

        if index + 1 < len(matches):
            end = matches[index + 1].start()
        else:
            end = len(text)

        question_text = text[start:end].strip()

        current_question["sub_questions"].append(
            {
                "label": label,
                "text": question_text,
            }
        )

    return grouped_questions