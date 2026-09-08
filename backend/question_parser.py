import re


def split_into_questions(text: str):
    """Split exam text into main questions, each containing sub-questions."""
    text = text.replace("\r", "\n")

    pattern = re.compile(r"(?m)^\s*(?:(\d+)\s*)?\(([a-e])\)")
    matches = list(pattern.finditer(text))

    grouped_questions = []
    current_question = None

    for index, match in enumerate(matches):
        main_number = match.group(1)
        label = match.group(2)

        if main_number is not None:
            current_question = {
                "question_number": main_number,
                "sub_questions": [],
            }
            grouped_questions.append(current_question)

        if current_question is None:
            continue

        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)

        current_question["sub_questions"].append({
            "label": label,
            "text": text[start:end].strip(),
        })

    return grouped_questions
