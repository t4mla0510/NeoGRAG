import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File

from app.config import config
from app.services.file_processor import FileProcessor
from app.utils.bm25_indexer import BM25Indexer
from app.utils.chroma_client import ChromaClient
from app.lib.graphrag_builder import GraphRAGBuilder

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".md", ".txt", ".docx"}


@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    for file in files:
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {ext}. Supported: {', '.join(ALLOWED_EXTENSIONS)}",
            )

    collection_name = "academic_regulation"

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        saved_files = []

        for file in files:
            file_path = temp_path / file.filename
            content = await file.read()
            file_path.write_bytes(content)
            saved_files.append(file_path)

        processor = FileProcessor(collection_name=collection_name)

        all_chunks = []
        all_ids = []
        all_metadatas = []

        for file_path in saved_files:
            try:
                chunks, ids, metadatas = processor.process_file(file_path)
                all_chunks.extend(chunks)
                all_ids.extend(ids)
                all_metadatas.extend(metadatas)
                logger.info(f"Processed {file_path.name}: {len(chunks)} chunks")
            except Exception as e:
                logger.error(f"Failed to process {file_path.name}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to process {file_path.name}: {str(e)}")

        if not all_chunks:
            raise HTTPException(status_code=400, detail="No content extracted from files")

        client = ChromaClient.get_instance()
        client.add_documents(
            collection_name=collection_name,
            documents=all_chunks,
            ids=all_ids,
            metadatas=all_metadatas,
        )
        logger.info(f"Added {len(all_chunks)} chunks to ChromaDB")

        bm25_indexer = BM25Indexer.get_instance()
        if bm25_indexer.load_index(collection_name):
            bm25_indexer.add_documents(
                texts=all_chunks,
                ids=all_ids,
                metadatas=all_metadatas,
                collection_name=collection_name,
            )
            bm25_indexer.save_index(collection_name)
        else:
            bm25_indexer.index_documents(
                texts=all_chunks,
                ids=all_ids,
                metadatas=all_metadatas,
                collection_name=collection_name,
            )
            bm25_indexer.save_index(collection_name)
        logger.info("Updated BM25 index")

        try:
            builder = GraphRAGBuilder(
                data_dir=temp_path,
                collection_name=collection_name,
            )
            result = builder.build(reset=False, show_progress=False)
            logger.info(f"Updated GraphRAG: {result.get('nodes', 0)} nodes, {result.get('edges', 0)} edges")
        except Exception as e:
            logger.warning(f"GraphRAG update failed: {e}")

    return {
        "message": "Files processed successfully",
        "files": len(files),
        "chunks": len(all_chunks),
        "collection": collection_name,
    }