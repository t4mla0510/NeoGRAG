import hashlib
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone

from app.config import PROJECT_ROOT, REPO_ROOT, config
from app.utils.text_utils import split_text_into_chunks

import docx
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, TesseractOcrOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

logger = logging.getLogger(__name__)


class FileProcessor:
    """Process various file formats into text chunks."""

    HASH_LENGTH = 8
    DATETIME_FORMAT = "%Y%m%d_%H%M%S"

    def __init__(
        self,
        collection_name: str = "academic_regulation",
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        use_ocr: bool = False,
    ):
        self.collection_name = collection_name
        self.chunk_size = chunk_size or config.DEFAULT_CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or config.DEFAULT_CHUNK_OVERLAP
        self.timestamp = datetime.now(timezone.utc).strftime(self.DATETIME_FORMAT)
        self.use_ocr = use_ocr

    def generate_id(self, chunk: str, index: int = 0, file_mtime: float = 0.0) -> str:
        content_hash = hashlib.sha256(chunk.encode()).hexdigest()
        mtime_hex = hex(int(file_mtime))[2:]
        return f"{self.collection_name}_{self.timestamp}_{index}_{mtime_hex}_{content_hash[:16]}"

    def process_file(self, file_path: Path) -> tuple[list[str], list[str], list[dict]]:
        text = self.extract_markdown_text(file_path)
        return self.process_text(file_path, text)

    def process_text(self, file_path: Path, text: str) -> tuple[list[str], list[str], list[dict]]:
        return self._chunk_text(file_path, text)

    def extract_markdown_text(self, file_path: Path) -> str:
        ext = file_path.suffix.lower()
        if ext == ".md":
            return file_path.read_text(encoding="utf-8")
        elif ext == ".txt":
            return file_path.read_text(encoding="utf-8")
        elif ext == ".pdf":
            return self._extract_pdf_markdown(file_path)
        elif ext == ".docx":
            return self._extract_docx_text(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    def _process_markdown(self, file_path: Path) -> tuple[list[str], list[str], list[dict]]:
        return self.process_text(file_path, self.extract_markdown_text(file_path))

    def _process_text(self, file_path: Path) -> tuple[list[str], list[str], list[dict]]:
        return self.process_text(file_path, self.extract_markdown_text(file_path))

    def _process_pdf(self, file_path: Path) -> tuple[list[str], list[str], list[dict]]:
        return self.process_text(file_path, self._extract_pdf_markdown(file_path))

    def _has_text_layer(self, file_path: Path, sample_pages: int = 2) -> bool:
        from pypdf import PdfReader

        reader = PdfReader(str(file_path))
        page_limit = min(sample_pages, len(reader.pages))
        for i in range(page_limit):
            text = (reader.pages[i].extract_text() or "").strip()
            if len(text) >= 40:
                return True
        return False

    def _extract_pdf_markdown(self, file_path: Path) -> str:
        enable_ocr = self.use_ocr or not self._has_text_layer(file_path)
        pipeline_options = PdfPipelineOptions()
        if enable_ocr:
            pipeline_options.do_ocr = True
            pipeline_options.ocr_options = TesseractOcrOptions(
                force_full_page_ocr=True,
                lang=["vie", "eng"],
            )

        converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_options=pipeline_options,
                )
            }
        )

        result = converter.convert(str(file_path))
        return result.document.export_to_markdown()

    def _process_docx(self, file_path: Path) -> tuple[list[str], list[str], list[dict]]:
        return self.process_text(file_path, self._extract_docx_text(file_path))

    def _extract_docx_text(self, file_path: Path) -> str:
        doc = docx.Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])

    def _chunk_text(self, file_path: Path, text: str) -> tuple[list[str], list[str], list[dict]]:
        chunks = split_text_into_chunks(
            text,
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
        )

        mtime = file_path.stat().st_mtime
        ids = [self.generate_id(chunk, i, mtime) for i, chunk in enumerate(chunks)]

        try:
            relative_path = str(file_path.relative_to(PROJECT_ROOT))
        except ValueError:
            try:
                relative_path = str(file_path.resolve().relative_to(REPO_ROOT.resolve()))
            except ValueError:
                relative_path = str(file_path.resolve())

        metadatas = [
            {"source": relative_path, "chunk_index": i, "file_name": file_path.name}
            for i in range(len(chunks))
        ]

        return chunks, ids, metadatas
