import re
from pathlib import Path

import pymupdf


WORD_PATTERN = re.compile(r"\b[^\W\d_]+\b")


class OcrUnavailableError(RuntimeError):
    """The OCR engine or required language data could not be used."""

    def __init__(self, page_number: int):
        self.page_number = page_number
        super().__init__(f"OCR is unavailable for PDF page {page_number}")


def extract_text_from_pdf(pdf_path: Path) -> str:
    pages = []

    with pymupdf.open(pdf_path) as document:
        tessdata = None

        for page_number, page in enumerate(document, start=1):
            text = page.get_text()
            word_count = len(WORD_PATTERN.findall(text))

            # Scan pages may contain selectable page numbers or footers.
            # Outlined glyphs look like vector drawings to the PDF engine.
            if word_count < 12 and (
                page.get_image_info() or len(page.get_cdrawings()) >= 50
            ):
                try:
                    if tessdata is None:
                        tessdata = pymupdf.get_tessdata()
                        if not (Path(tessdata) / "eng.traineddata").is_file():
                            raise RuntimeError("English OCR language data is missing")

                    ocr_page = page.get_textpage_ocr(
                        language="eng", dpi=300, full=True, tessdata=tessdata
                    )
                    recovered_text = ocr_page.extractText()
                except RuntimeError as error:
                    raise OcrUnavailableError(page_number) from error

                if len(WORD_PATTERN.findall(recovered_text)) > word_count:
                    text = recovered_text

            pages.append(f"\n--- PAGE {page_number} ---\n{text}")

    return "\n".join(pages)
