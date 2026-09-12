from question_parser import split_into_questions


def get_question_numbers(questions):
    return [
        question["question_number"]
        for question in questions
    ]


def get_labels(question):
    return [
        sub_question["label"]
        for sub_question in question["sub_questions"]
    ]


def test_numbered_parenthesised_subquestions():
    """
    Format:

        1 (a) ...
        1 (b) ...
        2 (a) ...
        2 (b) ...
    """

    text = """
1 (a) Explain the first concept.
1 (b) Describe another aspect of the concept.

2 (a) Compare two different approaches.
2 (b) Give one advantage of each approach.
"""

    questions = split_into_questions(text)

    assert len(questions) == 2
    assert get_question_numbers(questions) == ["1", "2"]

    assert get_labels(questions[0]) == ["a", "b"]
    assert get_labels(questions[1]) == ["a", "b"]

    assert "Explain the first concept" in (
        questions[0]["sub_questions"][0]["text"]
    )

    assert "Give one advantage" in (
        questions[1]["sub_questions"][1]["text"]
    )


def test_dotted_number_with_letter_subquestions():
    """
    Format:

        1. a) ...
           b) ...

        2. a) ...
           b) ...
    """

    text = """
1. a) Define the first technique.
b) Explain when the technique would be useful.

2. a) Describe the second technique.
b) Compare it with an alternative.
"""

    questions = split_into_questions(text)

    assert len(questions) == 2
    assert get_question_numbers(questions) == ["1", "2"]

    assert get_labels(questions[0]) == ["a", "b"]
    assert get_labels(questions[1]) == ["a", "b"]

    assert "Define the first technique" in (
        questions[0]["sub_questions"][0]["text"]
    )

    assert "Compare it with an alternative" in (
        questions[1]["sub_questions"][1]["text"]
    )


def test_q_style_questions():
    """
    Format:

        Q1:
        (a) ...
        (b) ...

        Q2:
        (a) ...
        (b) ...
    """

    text = """
Q1:
(a) Explain the purpose of the system.
(b) Describe how information is processed.

Q2:
(a) Compare the two methods.
(b) Discuss one limitation of each method.
"""

    questions = split_into_questions(text)

    assert len(questions) == 2
    assert get_question_numbers(questions) == ["1", "2"]

    assert get_labels(questions[0]) == ["a", "b"]
    assert get_labels(questions[1]) == ["a", "b"]

    assert "purpose of the system" in (
        questions[0]["sub_questions"][0]["text"]
    )

    assert "one limitation" in (
        questions[1]["sub_questions"][1]["text"]
    )


def test_standalone_dotted_questions():
    """
    Format:

        1. Explain ...
        2. Compare ...
        3. Discuss ...

    Questions have no lettered subparts.
    """

    text = """
1. Explain how the algorithm processes its input.

2. Compare the two proposed techniques.

3. Discuss the advantages and disadvantages of the approach.
"""

    questions = split_into_questions(text)

    assert len(questions) == 3
    assert get_question_numbers(questions) == ["1", "2", "3"]

    for question in questions:
        assert len(question["sub_questions"]) == 1
        assert question["sub_questions"][0]["label"] == ""

    assert "algorithm processes its input" in (
        questions[0]["sub_questions"][0]["text"]
    )

    assert "Compare the two proposed techniques" in (
        questions[1]["sub_questions"][0]["text"]
    )

    assert "advantages and disadvantages" in (
        questions[2]["sub_questions"][0]["text"]
    )


def test_standalone_plain_numbered_questions():
    """
    Format:

        1 Explain ...
        2 Describe ...
        3 Compare ...
    """

    text = """
1 Explain the purpose of the first component.

2 Describe how the second component operates.

3 Compare both components and discuss their differences.
"""

    questions = split_into_questions(text)

    assert len(questions) == 3
    assert get_question_numbers(questions) == ["1", "2", "3"]

    for question in questions:
        assert len(question["sub_questions"]) == 1
        assert question["sub_questions"][0]["label"] == ""

    assert "purpose of the first component" in (
        questions[0]["sub_questions"][0]["text"]
    )

    assert "second component operates" in (
        questions[1]["sub_questions"][0]["text"]
    )

    assert "Compare both components" in (
        questions[2]["sub_questions"][0]["text"]
    )


def test_mixed_question_layouts():
    """
    A single paper can change formatting part-way through.

    Example:

        1 (a) ...
        1 (b) ...

        2 (a) ...
        2 (b) ...

        3. Main question text
        (a) ...
        (b) ...
    """

    text = """
1 (a) Define the first concept.
1 (b) Give an example of the first concept.

2 (a) Explain the second concept.
2 (b) Describe one limitation.

3. Consider a system that processes a set of observations.
(a) Describe the first stage of the system.
(b) Explain the purpose of the final stage.
"""

    questions = split_into_questions(text)

    assert len(questions) == 3
    assert get_question_numbers(questions) == ["1", "2", "3"]

    assert get_labels(questions[0]) == ["a", "b"]
    assert get_labels(questions[1]) == ["a", "b"]
    assert get_labels(questions[2]) == ["a", "b"]

    assert "Define the first concept" in (
        questions[0]["sub_questions"][0]["text"]
    )

    assert "Describe one limitation" in (
        questions[1]["sub_questions"][1]["text"]
    )

    assert "Describe the first stage" in (
        questions[2]["sub_questions"][0]["text"]
    )


def test_roman_numerals_are_not_subquestion_labels():
    """
    Roman-numeral task items such as:

        (i)
        (ii)
        (iii)

    must not be interpreted as top-level lettered subquestions.
    """

    text = """
1 (a) Complete the following tasks:
(i) calculate the first value;
(ii) calculate the second value;
(iii) explain the result.

1 (b) Discuss the significance of the result.

2 (a) Describe another method.
"""

    questions = split_into_questions(text)

    assert len(questions) == 2

    assert get_labels(questions[0]) == ["a", "b"]
    assert get_labels(questions[1]) == ["a"]

    first_subquestion = (
        questions[0]["sub_questions"][0]["text"]
    )

    assert "(i)" in first_subquestion
    assert "(ii)" in first_subquestion
    assert "(iii)" in first_subquestion


def test_figure_labels_are_not_treated_as_subquestions():
    """
    Figure labels such as:

        (a) (b)

    should not create fake exam subquestions.
    """

    text = """
1. Consider the diagrams below.

(a) (b)

(a) Explain the difference between the two diagrams.
(b) Describe what would happen under different conditions.

2. Discuss the overall behaviour of the system.
"""

    questions = split_into_questions(text)

    assert len(questions) == 2
    assert get_question_numbers(questions) == ["1", "2"]

    assert get_labels(questions[0]) == ["a", "b"]

    assert "difference between the two diagrams" in (
        questions[0]["sub_questions"][0]["text"]
    )

    assert "different conditions" in (
        questions[0]["sub_questions"][1]["text"]
    )

    assert len(questions[1]["sub_questions"]) == 1
    assert questions[1]["sub_questions"][0]["label"] == ""


def test_duplicate_subquestion_labels_are_ignored():
    """
    Duplicate formatting noise should not cause the same
    subquestion label to be returned more than once.
    """

    text = """
1 (a) Explain the first concept.

(a) Duplicate formatting noise that should not create
another subquestion with the same label.

1 (b) Explain the second concept.

2 (a) Describe another topic.
"""

    questions = split_into_questions(text)

    assert len(questions) == 2

    assert get_labels(questions[0]) == ["a", "b"]
    assert get_labels(questions[1]) == ["a"]

    assert get_labels(questions[0]).count("a") == 1


def test_parser_returns_empty_list_when_no_questions_exist():
    """
    Text with no recognisable exam-question structure
    should safely return an empty list.
    """

    text = """
University Examination

Instructions to candidates

Answer all required questions.

End of paper.
"""

    questions = split_into_questions(text)

    assert questions == []