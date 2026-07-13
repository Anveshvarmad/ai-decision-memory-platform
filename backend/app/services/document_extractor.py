import csv
import json
from pathlib import Path

import fitz


class DocumentExtractionError(Exception):
    pass


def extract_pdf(path: Path) -> list[dict]:
    segments: list[dict] = []

    try:
        with fitz.open(path) as document:
            for page_index, page in enumerate(document):
                text = page.get_text("text", sort=True).strip()

                if text:
                    segments.append(
                        {
                            "text": text,
                            "page_number": page_index + 1,
                            "section_title": None,
                        }
                    )
    except Exception as error:
        raise DocumentExtractionError(
            f"Unable to extract PDF text: {error}"
        ) from error

    return segments


def extract_plain_text(path: Path) -> list[dict]:
    try:
        text = path.read_text(
            encoding="utf-8",
            errors="replace",
        ).strip()
    except OSError as error:
        raise DocumentExtractionError(
            f"Unable to read text file: {error}"
        ) from error

    return [
        {
            "text": text,
            "page_number": None,
            "section_title": None,
        }
    ] if text else []


def extract_json(path: Path) -> list[dict]:
    try:
        with path.open(
            "r",
            encoding="utf-8",
            errors="replace",
        ) as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        raise DocumentExtractionError(
            f"Unable to parse JSON file: {error}"
        ) from error

    formatted = json.dumps(
        data,
        indent=2,
        ensure_ascii=False,
    )

    return [
        {
            "text": formatted,
            "page_number": None,
            "section_title": None,
        }
    ]


def extract_csv(path: Path) -> list[dict]:
    rows: list[str] = []

    try:
        with path.open(
            "r",
            encoding="utf-8",
            errors="replace",
            newline="",
        ) as file:
            reader = csv.DictReader(file)

            if reader.fieldnames is None:
                return []

            for row_number, row in enumerate(reader, start=1):
                values = [
                    f"{key}: {value}"
                    for key, value in row.items()
                    if value not in (None, "")
                ]

                if values:
                    rows.append(
                        f"Row {row_number}\n" + "\n".join(values)
                    )
    except (OSError, csv.Error) as error:
        raise DocumentExtractionError(
            f"Unable to parse CSV file: {error}"
        ) from error

    return [
        {
            "text": "\n\n".join(rows),
            "page_number": None,
            "section_title": "CSV Data",
        }
    ] if rows else []


def extract_document(path: Path) -> list[dict]:
    extension = path.suffix.lower()

    if extension == ".pdf":
        return extract_pdf(path)

    if extension in {".txt", ".md", ".markdown"}:
        return extract_plain_text(path)

    if extension == ".json":
        return extract_json(path)

    if extension == ".csv":
        return extract_csv(path)

    raise DocumentExtractionError(
        f"Unsupported document extension: {extension}"
    )
