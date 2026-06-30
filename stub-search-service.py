"""
Minimal stub search service for testing RemoteSearchProvider locally.
Implements /v1/health, /v1/ingest, /v1/search in-memory — no external deps.
Run: .venv-stub/bin/uvicorn stub-search-service:app --port 8080
"""
import math
import uuid
from typing import Optional
from fastapi import FastAPI, Query, Request
from pydantic import BaseModel

app = FastAPI()

# In-memory store: list of {id, content, metadata, tenant_id, embedding}
docs: list[dict] = []


def simple_embed(text: str) -> list[float]:
    """Deterministic bag-of-chars embedding for testing — good enough for cosine sim."""
    vec = [0.0] * 64
    for i, ch in enumerate(text.lower()):
        vec[ord(ch) % 64] += 1.0
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(x * x for x in b)) or 1.0
    return dot / (na * nb)


# ── Models ────────────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    content: str
    metadata: dict[str, str] = {}
    tenant_id: Optional[str] = None
    document_id: Optional[str] = None


class IngestResponse(BaseModel):
    id: str
    success: bool


class SearchResult(BaseModel):
    id: str
    content: str
    metadata: dict[str, str]
    score: float


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total_count: int
    query: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/v1/health")
def health():
    return {"status": "ok", "docs": len(docs)}


@app.post("/v1/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest):
    doc_id = req.document_id or str(uuid.uuid4())
    # upsert by id
    existing = next((i for i, d in enumerate(docs) if d["id"] == doc_id), None)
    entry = {
        "id": doc_id,
        "content": req.content,
        "metadata": req.metadata,
        "tenant_id": req.tenant_id or "global",
        "embedding": simple_embed(req.content),
    }
    if existing is not None:
        docs[existing] = entry
    else:
        docs.append(entry)
    return IngestResponse(id=doc_id, success=True)


@app.get("/v1/search", response_model=SearchResponse)
def search(
    request: Request,
    q: str = Query(...),
    k: int = Query(10),
    tenant_id: Optional[str] = Query(None),
):
    # Collect arbitrary metadata.* filter params from query string
    excluded = {"q", "k", "tenant_id"}
    extra_filters = {key: value for key, value in request.query_params.items() if key not in excluded}

    qvec = simple_embed(q)
    candidates = docs
    if tenant_id:
        candidates = [d for d in candidates if d["tenant_id"] == tenant_id]
    for key, value in extra_filters.items():
        # metadata.foo=bar maps to doc["metadata"]["foo"] == "bar"
        if key.startswith("metadata."):
            meta_key = key[len("metadata."):]
            candidates = [d for d in candidates if d["metadata"].get(meta_key) == value]
        else:
            candidates = [d for d in candidates if d.get(key) == value]

    scored = sorted(
        [{"doc": d, "score": cosine(qvec, d["embedding"])} for d in candidates],
        key=lambda x: x["score"],
        reverse=True,
    )[:k]

    return SearchResponse(
        results=[
            SearchResult(id=r["doc"]["id"], content=r["doc"]["content"], metadata=r["doc"]["metadata"], score=r["score"])
            for r in scored
        ],
        total_count=len(scored),
        query=q,
    )
