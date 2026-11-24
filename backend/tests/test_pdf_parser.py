import pymupdf
import pytest

from pdf_parser import OcrUnavailableError, extract_text_from_pdf
from question_parser import split_into_questions


@pytest.fixture
def outlined_paper(tmp_path):
    path = tmp_path / "paper.pdf"
    with pymupdf.open() as document:
        first_page = document.new_page()
        first_page.insert_text((40, 800), "CS410 January 2022")
        for index in range(55):
            first_page.draw_line((40, 40 + index * 2), (80, 40 + index * 2))
        document.new_page().insert_text(
            (40, 40),
            "2. Explain how a camera captures light and describe why exposure is important.",
        )
        document.save(path)
    return path


def test_ocr_recovers_outline_page_and_keeps_readable_page(outlined_paper, tmp_path, monkeypatch):
    (tmp_path / "eng.traineddata").touch()
    monkeypatch.setattr(pymupdf, "get_tessdata", lambda: str(tmp_path))
    calls = []

    def recognize(page, **options):
        calls.append(page.number)
        assert options["full"] is True
        with pymupdf.open() as document:
            recognized = document.new_page()
            recognized.insert_text(
                (40, 40),
                "1. Describe how a lens focuses incoming light onto an image sensor.",
            )
            text_page = recognized.get_textpage()
        return text_page

    monkeypatch.setattr(pymupdf.Page, "get_textpage_ocr", recognize)
    questions = split_into_questions(extract_text_from_pdf(outlined_paper))

    assert calls == [0]
    assert [question["question_number"] for question in questions] == ["1", "2"]


def test_missing_ocr_language_reports_affected_page(outlined_paper, tmp_path, monkeypatch):
    monkeypatch.setattr(pymupdf, "get_tessdata", lambda: str(tmp_path))
    with pytest.raises(OcrUnavailableError) as error:
        extract_text_from_pdf(outlined_paper)

    assert error.value.page_number == 1
