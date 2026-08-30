"""FlowMind API: durable multi-source ingestion and source-grounded learning APIs."""
from __future__ import annotations

import json
import os
import re
import tempfile
import uuid
from collections import Counter
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from utils.document_processor import DocumentProcessor
from utils.mistral_client import MistralClient

DATA_DIR = Path(os.getenv("FLOWMIND_DATA_DIR", "./data")).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_BYTES = int(os.getenv("MAX_FILE_BYTES", str(25 * 1024 * 1024)))
SUPPORTED_EXTENSIONS = {".pdf", ".pptx", ".txt", ".md", ".docx"}

app = FastAPI(title="FlowMind API", version="2.0.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
processor, llm = DocumentProcessor(), MistralClient()


class GenerateRequest(BaseModel):
    workspace_id: Optional[str] = None
    document_id: Optional[str] = None
    content: Optional[str] = None
    topics: list[str] = []
    concepts: list[str] = []
    type: Optional[str] = None
    nodeTitle: Optional[str] = None


class TutorRequest(BaseModel):
    question: str
    workspace_id: Optional[str] = None
    content: Optional[str] = None


STOP_WORDS = {"the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "have", "has", "into", "your", "you", "about", "what", "when", "where", "which", "their", "then", "than"}


def _workspace_dir(workspace_id: str) -> Path:
    if not re.fullmatch(r"[a-zA-Z0-9_-]{6,80}", workspace_id):
        raise HTTPException(400, "Invalid workspace id")
    path = DATA_DIR / workspace_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _manifest(workspace_id: str) -> dict[str, Any]:
    path = _workspace_dir(workspace_id) / "manifest.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"workspace_id": workspace_id, "sources": []}


def _save_manifest(manifest: dict[str, Any]) -> None:
    directory = _workspace_dir(manifest["workspace_id"])
    temporary = directory / "manifest.tmp"
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(directory / "manifest.json")


def _tokenize(text: str) -> list[str]:
    return [word for word in re.findall(r"[a-zA-Z0-9]{2,}", text.lower()) if word not in STOP_WORDS]


def _source_chunks(workspace_id: str) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    for source in _manifest(workspace_id)["sources"]:
        path = _workspace_dir(workspace_id) / source["chunks_file"]
        if path.exists():
            chunks.extend(json.loads(path.read_text(encoding="utf-8")))
    return chunks


def _retrieve(workspace_id: str, query: str, limit: int = 7) -> list[dict[str, Any]]:
    terms = Counter(_tokenize(query))
    scored = []
    for chunk in _source_chunks(workspace_id):
        words = Counter(_tokenize(chunk["text"]))
        overlap = sum(min(count, words[word]) for word, count in terms.items())
        scored.append((overlap * 3 + sum(1.5 for token in terms if token in chunk["text"].lower()), chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    selected = [item[1] for item in scored[:limit] if item[0] > 0]
    return selected or [item[1] for item in scored[: min(3, limit)]]


def _context(workspace_id: Optional[str], fallback: Optional[str], query: str = "main concepts") -> tuple[str, list[dict[str, Any]]]:
    if workspace_id:
        chunks = _retrieve(workspace_id, query)
        citations = [{"index": i, "source_id": c["source_id"], "filename": c["filename"], "locator": c["locator"], "excerpt": c["text"][:320]} for i, c in enumerate(chunks, 1)]
        text = "\n\n".join(f"[{i}] {c['filename']} — {c['locator']}\n{c['text']}" for i, c in enumerate(chunks, 1))
        if text:
            return text, citations
    return (fallback or "")[:16000], []


def _concepts(text: str, limit: int = 30) -> list[str]:
    candidates = re.findall(r"\b[A-Z][a-zA-Z0-9-]+(?:\s+[A-Z][a-zA-Z0-9-]+){0,3}\b", text)
    return [item for item, _ in Counter(x.strip() for x in candidates if len(x.strip()) > 3).most_common(limit)]


def _topics(text: str, limit: int = 18) -> list[str]:
    lines = [re.sub(r"^[#\d.\-•\s]+", "", line).strip() for line in text.splitlines()]
    headings = [line for line in lines if 3 < len(line) < 100 and (line.istitle() or line.isupper())]
    return list(dict.fromkeys(headings))[:limit] or _concepts(text, limit)


async def _ingest(file: UploadFile, workspace_id: str) -> dict[str, Any]:
    suffix = Path(file.filename or "source.txt").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {suffix}")
    payload = await file.read(MAX_FILE_BYTES + 1)
    if len(payload) > MAX_FILE_BYTES:
        raise HTTPException(413, "File is too large")
    source_id = f"src_{uuid.uuid4().hex[:12]}"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
        temporary.write(payload)
        temp_path = Path(temporary.name)
    try:
        extracted = await processor.process_document(str(temp_path))
    finally:
        temp_path.unlink(missing_ok=True)
    filename = Path(file.filename or "source").name
    chunks = [{"id": f"{source_id}_chunk_{i}", "source_id": source_id, "filename": filename, "locator": f"chunk {i}" if extracted.get("page_count", 1) == 1 else f"page/slide area {i}", "text": text} for i, text in enumerate(extracted["chunks"], 1)]
    chunk_file = f"{source_id}.json"
    (_workspace_dir(workspace_id) / chunk_file).write_text(json.dumps(chunks, ensure_ascii=False), encoding="utf-8")
    return {"id": source_id, "filename": filename, "file_type": suffix.lstrip("."), "page_count": extracted.get("page_count", 1), "word_count": len(extracted["raw_text"].split()), "chunks_file": chunk_file, "preview": extracted["raw_text"][:700], "raw_text": extracted["raw_text"]}


@app.get("/")
@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "flowmind-api", "version": "2.0.0"}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...), workspace_id: Optional[str] = Form(None)) -> dict[str, Any]:
    workspace_id = workspace_id or f"ws_{uuid.uuid4().hex[:12]}"
    source = await _ingest(file, workspace_id)
    raw_text = source.pop("raw_text")
    manifest = _manifest(workspace_id)
    manifest["sources"].append(source)
    _save_manifest(manifest)
    combined = "\n\n".join(item.get("preview", "") for item in manifest["sources"])
    public_sources = [{k: v for k, v in item.items() if k != "chunks_file"} for item in manifest["sources"]]
    return {"workspace_id": workspace_id, "document_id": source["id"], "file_id": source["id"], "filename": source["filename"], "sources": public_sources, "topics": _topics(combined), "sections": _topics(raw_text, 30), "concept_list": _concepts(combined, 50), "raw_text": combined[:16000], "word_count": sum(item["word_count"] for item in manifest["sources"])}


@app.get("/workspaces/{workspace_id}")
async def get_workspace(workspace_id: str) -> dict[str, Any]:
    manifest = _manifest(workspace_id)
    manifest["sources"] = [{k: v for k, v in item.items() if k != "chunks_file"} for item in manifest["sources"]]
    return manifest


@app.post("/tutor")
async def tutor(request: TutorRequest) -> dict[str, Any]:
    context, citations = _context(request.workspace_id, request.content, request.question)
    if not context:
        raise HTTPException(400, "Add at least one source before asking the tutor")
    prompt = f"""Answer only from the supplied source excerpts. Cite claims inline with [1], [2], etc. If the sources do not support an answer, say so plainly. Return JSON with keys explanation, simplified, diagram_desc, practice (array of question/answer objects), and tips (array of strings).
Question: {request.question}
Sources:\n{context}"""
    result = await llm.generate_json_response(prompt)
    if not result or result.get("error"):
        result = {"explanation": "\n\n".join(f"[{i}] {item['excerpt']}" for i, item in enumerate(citations[:3], 1)), "simplified": "The answer is grounded in the most relevant passages shown in Sources.", "diagram_desc": "Connect the central question to each cited source passage.", "practice": [], "tips": ["Open each citation and verify the surrounding passage."]}
    result["citations"] = citations
    return result


@app.post("/generate/summary")
async def generate_summary(request: GenerateRequest) -> dict[str, Any]:
    context, citations = _context(request.workspace_id, request.content, "main ideas conclusions evidence")
    style = request.type or "one_page"
    result = await llm.generate_json_response(f"Summarize these sources as {style}. Use inline [n] citations. Return JSON with key {style}.\n\n{context}")
    if not result or result.get("error"):
        result = {style: context[:4000]}
    result["citations"] = citations
    return result


@app.post("/generate/flashcards")
async def generate_flashcards(request: GenerateRequest) -> list[dict[str, Any]]:
    context, citations = _context(request.workspace_id, request.content, "definitions concepts relationships")
    result = await llm.generate_json_response(f"Create 12 study flashcards grounded in these sources. Return a JSON array with question, answer, difficulty, tag, citation_index.\n\n{context}", expect_array=True)
    if isinstance(result, list) and result:
        return result
    concepts = request.concepts or _concepts(context, 12)
    return [{"question": f"What is {item}?", "answer": f"Review {item} in the source context.", "difficulty": "medium", "tag": "source", "citation_index": min(i + 1, len(citations)) or None} for i, item in enumerate(concepts[:12])]


@app.post("/generate/graph")
async def generate_graph(request: GenerateRequest) -> dict[str, Any]:
    context, citations = _context(request.workspace_id, request.content, "main concepts relationships hierarchy")
    prompt = "Build a hierarchical knowledge tree from the sources. Return JSON with nodes and edges. Each node has id, title, description, children, parent when applicable, level, type (topic|concept|detail), and citation_indices. Each edge has id, source, target, type.\n\n" + context
    result = await llm.generate_json_response(prompt)
    if result and isinstance(result.get("nodes"), list):
        result["citations"] = citations
        return result
    topics = (request.topics or _topics(context, 8))[:8]
    nodes = [{"id": "root", "title": "Source Library", "description": "All uploaded sources", "children": [f"topic-{i}" for i in range(len(topics))], "level": 0, "type": "topic"}]
    nodes += [{"id": f"topic-{i}", "title": topic, "description": f"Source-grounded concept: {topic}", "children": [], "parent": "root", "level": 1, "type": "concept", "citation_indices": [min(i + 1, len(citations))] if citations else []} for i, topic in enumerate(topics)]
    edges = [{"id": f"edge-{i}", "source": "root", "target": f"topic-{i}", "type": "default"} for i in range(len(topics))]
    return {"nodes": nodes, "edges": edges, "citations": citations}


@app.post("/node/details")
async def node_details(request: GenerateRequest) -> dict[str, Any]:
    title = request.nodeTitle or "concept"
    context, citations = _context(request.workspace_id, request.content, title)
    result = await llm.generate_json_response(f"Explain {title} only from the sources with inline [n] citations. Return JSON keys theory, simplified, examples, flashcards, references.\n\n{context}")
    if not result or result.get("error"):
        result = {"theory": context[:1800], "simplified": context[:700], "examples": [], "flashcards": [], "references": []}
    result["citations"] = citations
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
