from pathlib import Path

from pdf_parser import extract_text_from_pdf
from question_parser import split_into_questions


pdf_path = Path("../storage/368cc46b-75cf-4cdc-83fc-9d98ee8e9980.pdf")

text = extract_text_from_pdf(pdf_path)
questions = split_into_questions(text)

print(f"\nFound {len(questions)} main questions\n")

for question in questions:
    print("=" * 80)
    print(f"QUESTION {question['question_number']}")
    print("=" * 80)

    for sub_question in question["sub_questions"]:
        label = sub_question["label"]
        print(f"\n{question['question_number']}({label})")
        print("-" * 40)
        print(sub_question["text"])

    print()
