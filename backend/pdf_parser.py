import pymupdf
from pathlib import Path


def extract_text_from_pdf(pdf_path: Path) -> str:
    document = pymupdf.open(pdf_path)

    pages = []

    for page_number, page in enumerate(document, start=1):
        text = page.get_text()

        pages.append(
            f"\n--- PAGE {page_number} ---\n{text}"
        )

    document.close()

    return "\n".join(pages)