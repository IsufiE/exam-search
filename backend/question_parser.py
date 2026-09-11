import re


def split_into_questions(text: str):
    """
    Parse multiple Maynooth exam question formats.

    Supported examples:

        1 (a) ...
        1 (b) ...

        1. a) ...
        b) ...

        Q1:
        (a) ...
        (b) ...

        1. Question ...
        2. Question ...

        1 Question ...
        2 Question ...

        Mixed layouts:
        1 (a) ...
        1 (b) ...
        2 (a) ...
        ...
        3. Main question text
        (a) ...
        (b) ...

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

    # --------------------------------------------------
    # First handle Q1:, Q2:, Q3: style
    # --------------------------------------------------

    q_pattern = re.compile(
        r"(?m)^\s*Q(\d{1,2})\s*:\s*"
    )

    q_matches = list(
        q_pattern.finditer(text)
    )

    if q_matches:
        return parse_q_style(
            text,
            q_matches
        )

    # --------------------------------------------------
    # Find candidates for main questions
    # --------------------------------------------------

    candidates = []

    # Style:
    #
    # 1 (a)
    # 1(a)
    # 1. a)
    #
    numbered_sub_pattern = re.compile(
        r"""
        ^\s*
        (\d{1,2})
        \s*
        \.?
        \s*
        (?:
            \(([a-h])\)
            |
            ([a-h])\)
        )
        """,
        re.MULTILINE | re.VERBOSE,
    )

    for match in numbered_sub_pattern.finditer(text):
        candidates.append(
            {
                "number": int(match.group(1)),
                "position": match.start(),
            }
        )

    # Style:
    #
    # 3. Consider ...
    #
    dotted_main_pattern = re.compile(
        r"""
        ^\s*
        (\d{1,2})
        \.
        \s+
        (?=[A-Z])
        """,
        re.MULTILINE | re.VERBOSE,
    )

    for match in dotted_main_pattern.finditer(text):
        candidates.append(
            {
                "number": int(match.group(1)),
                "position": match.start(),
            }
        )

    # Style:
    #
    # 1 Explain ...
    # 2 Compare ...
    #
    # Used by some CS402 papers.
    #
    plain_main_pattern = re.compile(
        r"""
        ^\s*
        (\d{1,2})
        \s+
        (?=[A-Z][A-Za-z])
        """,
        re.MULTILINE | re.VERBOSE,
    )

    for match in plain_main_pattern.finditer(text):
        candidates.append(
            {
                "number": int(match.group(1)),
                "position": match.start(),
            }
        )

    if not candidates:
        return []

    # --------------------------------------------------
    # Sort by document position
    # --------------------------------------------------

    candidates.sort(
        key=lambda item:
            item["position"]
    )

    # --------------------------------------------------
    # Find one boundary per question number.
    #
    # We specifically expect a normal exam sequence:
    #
    # 1, 2, 3, 4, ...
    #
    # This prevents random numbers inside questions
    # from becoming new main questions.
    # --------------------------------------------------

    boundaries = []

    expected_number = 1
    search_position = 0

    while True:
        matching_candidates = [
            candidate
            for candidate in candidates
            if (
                candidate["number"] == expected_number
                and
                candidate["position"] >= search_position
            )
        ]

        if not matching_candidates:
            break

        boundary = min(
            matching_candidates,
            key=lambda item:
                item["position"]
        )

        boundaries.append(
            boundary
        )

        search_position = (
            boundary["position"] + 1
        )

        expected_number += 1

    if not boundaries:
        return []

    # --------------------------------------------------
    # Parse each main-question block
    # --------------------------------------------------

    questions = []

    for index, boundary in enumerate(boundaries):

        question_number = str(
            boundary["number"]
        )

        start = boundary["position"]

        if index + 1 < len(boundaries):
            end = boundaries[
                index + 1
            ]["position"]
        else:
            end = len(text)

        block = text[
            start:end
        ]

        sub_questions = parse_subquestions(
            block,
            question_number
        )

        # No lettered subparts:
        # treat entire block as one standalone question.
        if not sub_questions:

            cleaned_text = (
                block.strip()
            )

            if cleaned_text:
                sub_questions = [
                    {
                        "label": "",
                        "text": cleaned_text,
                    }
                ]

        questions.append(
            {
                "question_number":
                    question_number,

                "sub_questions":
                    sub_questions,
            }
        )

    return questions


def parse_subquestions(
    block: str,
    question_number: str
):
    """
    Parse actual lettered sub-questions.

    Intentionally supports a-h but NOT i.

    This prevents Roman-numeral items such as:

        (i)
        (ii)
        (iii)

    from being incorrectly treated as exam sub-questions.
    """

    pattern = re.compile(
        rf"""
        ^\s*
        (?:
            # Numbered forms:
            #
            # 1 (a)
            # 1(a)
            # 1. a)
            #
            (?:
                {re.escape(question_number)}
                \s*
                \.?
                \s*
            )
            (?:
                \(([a-h])\)
                |
                ([a-h])\)
            )

            |

            # Unnumbered:
            #
            # (a)
            #
            \(([a-h])\)

            |

            # a)
            #
            ([a-h])\)
        )
        """,
        re.MULTILINE | re.VERBOSE,
    )

    raw_matches = list(
        pattern.finditer(block)
    )

    # --------------------------------------------------
    # Remove false markers such as:
    #
    # (a) (b)
    #
    # used only as image/figure labels.
    # --------------------------------------------------

    matches = []

    for match in raw_matches:

        line_end = block.find(
            "\n",
            match.end()
        )

        if line_end == -1:
            line_end = len(block)

        remainder = block[
            match.end():line_end
        ].strip()

        # Figure-style label:
        #
        # (a) (b)
        #
        if re.match(
            r"^\([a-z]\)",
            remainder
        ):
            continue

        matches.append(
            match
        )

    if not matches:
        return []

    # --------------------------------------------------
    # Avoid duplicate labels caused by figures or
    # formatting noise.
    # --------------------------------------------------

    accepted_matches = []
    seen_labels = set()

    for match in matches:

        label = (
            match.group(1)
            or match.group(2)
            or match.group(3)
            or match.group(4)
        )

        if label in seen_labels:
            continue

        seen_labels.add(
            label
        )

        accepted_matches.append(
            (
                match,
                label
            )
        )

    # --------------------------------------------------
    # Build sub-question text ranges
    # --------------------------------------------------

    sub_questions = []

    for index, (
        match,
        label
    ) in enumerate(
        accepted_matches
    ):

        start = match.start()

        if (
            index + 1
            <
            len(accepted_matches)
        ):
            end = accepted_matches[
                index + 1
            ][0].start()

        else:
            end = len(block)

        question_text = block[
            start:end
        ].strip()

        sub_questions.append(
            {
                "label":
                    label,

                "text":
                    question_text,
            }
        )

    return sub_questions


def parse_q_style(
    text: str,
    q_matches
):
    """
    Parse:

        Q1:
        (a) ...
        (b) ...

        Q2:
        ...

    Used by papers such as CS401.
    """

    questions = []

    for index, match in enumerate(
        q_matches
    ):

        question_number = (
            match.group(1)
        )

        start = match.end()

        if (
            index + 1
            <
            len(q_matches)
        ):
            end = q_matches[
                index + 1
            ].start()

        else:
            end = len(text)

        block = text[
            start:end
        ]

        sub_questions = (
            parse_subquestions(
                block,
                question_number
            )
        )

        if not sub_questions:

            cleaned_text = (
                block.strip()
            )

            if cleaned_text:
                sub_questions = [
                    {
                        "label": "",
                        "text": cleaned_text,
                    }
                ]

        questions.append(
            {
                "question_number":
                    question_number,

                "sub_questions":
                    sub_questions,
            }
        )

    return questions