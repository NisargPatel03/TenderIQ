import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from supabase import create_client, Client

# Load environment variables from backend/.env relative to this file
env_path = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=env_path)

from parser import extract_content, ExtractionError
from gemini import GeminiClient

app = FastAPI(title="TenderIQ API", version="1.0.0")

# ─── CORS ────────────────────────────────────────────────────────────────────
# Allow ALL origins so Vercel edge + local dev both work.
# The vercel.json edge-level headers act as a second layer of defence.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,          # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Gemini Client ────────────────────────────────────────────────────────────
try:
    gemini_client = GeminiClient()
except Exception as e:
    print(f"WARNING: Gemini client could not be initialized: {e}")
    gemini_client = None


# ─── Supabase helper ──────────────────────────────────────────────────────────
def get_supabase(auth_header: Optional[str] = None) -> Client:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("VITE_SUPABASE_ANON_KEY")
    )
    if not url or not key:
        raise ValueError("Supabase credentials are not set in environment variables.")
    client = create_client(url, key)
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        client.postgrest.auth(token)
    return client


# ─── Pydantic schemas ─────────────────────────────────────────────────────────
class QARequest(BaseModel):
    document_text: str
    question: str
    history: List[dict] = []
    tender_id: Optional[str] = None


class GoNoGoRequest(BaseModel):
    analysis_result: dict
    company_profile: str


# ─── Routes ───────────────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {
        "name": "TenderIQ API",
        "version": "1.0.0",
        "description": "FastAPI backend for AI-powered Tender Analysis & Intelligence",
        "endpoints": {
            "health": "/api/health",
            "upload": "/api/upload",
            "qa": "/api/qa",
            "gonogo": "/api/gonogo",
        },
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "gemini_api_configured": os.environ.get("GEMINI_API_KEY") is not None,
        "supabase_configured": os.environ.get("SUPABASE_URL") is not None,
    }


@app.get("/api/tenders/{tender_id}/status")
def get_tender_status(
    tender_id: str, authorization: Optional[str] = Header(None)
):
    """Poll the processing status of a tender."""
    try:
        supabase = get_supabase(authorization)
        res = (
            supabase.table("tenders")
            .select("id,status,analysis_result,extracted_text,page_count,file_size")
            .eq("id", tender_id)
            .single()
            .execute()
        )
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload")
async def upload_document(
    tender_id: str = Form(...),
    files: List[UploadFile] = File(default=[]),
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
):
    """
    Synchronous upload handler compatible with Vercel serverless.
    The frontend pre-creates the tender row (status='Processing').
    This endpoint extracts text, runs AI analysis, embeds chunks,
    then updates the row to status='Active'.
    """
    if not gemini_client:
        raise HTTPException(
            status_code=500,
            detail="Gemini API Client is not configured. Check backend environment variables.",
        )

    # ── 1. Text extraction ────────────────────────────────────────────────────
    extracted_text = ""
    page_count = 0
    file_size = 0

    try:
        all_files = list(files or [])
        if file:
            all_files.append(file)

        if all_files:
            parts, total_pages, total_size = [], 0, 0
            for f in all_files:
                data = await f.read()
                total_size += len(data)
                f_text, f_pages = extract_content(data, f.filename)
                parts.append(
                    f"\n=========================================\n"
                    f"DOCUMENT: {f.filename}\n"
                    f"=========================================\n\n{f_text}"
                )
                total_pages += f_pages
            extracted_text = "\n".join(parts)
            page_count = total_pages
            file_size = total_size

        elif raw_text:
            extracted_text = raw_text.strip()
            file_size = len(extracted_text.encode("utf-8"))
            page_count = max(1, len(extracted_text) // 3000 + 1)

        else:
            raise HTTPException(
                status_code=400,
                detail="Either file uploads or raw_text is required.",
            )

    except ExtractionError as ee:
        # Mark as Failed in DB then propagate
        _mark_failed(tender_id, authorization)
        raise HTTPException(status_code=400, detail=str(ee))
    except HTTPException:
        raise
    except Exception as e:
        _mark_failed(tender_id, authorization)
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {e}")

    # ── 2. AI compliance analysis ─────────────────────────────────────────────
    try:
        analysis = gemini_client.extract_tender_details(extracted_text)
        deadline = analysis.get("deadline")
    except Exception as e:
        _mark_failed(tender_id, authorization)
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {e}")

    # ── 3. Update tender record to Active ─────────────────────────────────────
    try:
        supabase = get_supabase(authorization)
        supabase.table("tenders").update(
            {
                "status": "Active",
                "page_count": page_count,
                "file_size": file_size,
                # Store a 100 000-char snippet to keep DB lean
                "extracted_text": extracted_text[:100_000],
                "analysis_result": analysis,
                "deadline": deadline,
            }
        ).eq("id", tender_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database update failed: {e}")

    # ── 4. Best-effort RAG chunking & embeddings (non-blocking on failure) ────
    try:
        chunks = gemini_client.chunk_text(extracted_text)
        if chunks:
            batch_size = 50
            embeddings = []
            for i in range(0, len(chunks), batch_size):
                batch = chunks[i : i + batch_size]
                embeddings.extend(gemini_client.generate_embeddings(batch))

            payload = [
                {
                    "tender_id": tender_id,
                    "chunk_content": chunk,
                    "page_number": idx + 1,
                    "embedding": emb,
                }
                for idx, (chunk, emb) in enumerate(zip(chunks, embeddings))
            ]
            if payload:
                supabase.table("tender_chunks").insert(payload).execute()
    except Exception as e:
        # Chunking failure is non-fatal — the tender is already Active
        print(f"RAG chunking skipped for tender {tender_id}: {e}")

    return {
        "status": "completed",
        "tender_id": tender_id,
        "message": "Tender processed and saved successfully.",
    }


def _mark_failed(tender_id: str, auth_header: Optional[str]):
    """Helper to update a tender row to Failed status on error."""
    try:
        supabase = get_supabase(auth_header)
        supabase.table("tenders").update({"status": "Failed"}).eq(
            "id", tender_id
        ).execute()
    except Exception as db_err:
        print(f"Could not mark tender {tender_id} as Failed: {db_err}")


@app.post("/api/qa")
def ask_question(
    request: QARequest, authorization: Optional[str] = Header(None)
):
    """
    Answers a free-form user query.
    Uses pgvector RAG similarity search if tender_id is supplied,
    otherwise falls back to the full document_text.
    """
    if not gemini_client:
        raise HTTPException(
            status_code=500,
            detail="Gemini API Client is not configured.",
        )

    context = ""

    if request.tender_id:
        try:
            supabase = get_supabase(authorization)
            query_embeddings = gemini_client.generate_embeddings([request.question])
            if query_embeddings:
                rpc_res = supabase.rpc(
                    "match_tender_chunks",
                    {
                        "query_embedding": query_embeddings[0],
                        "match_threshold": 0.2,
                        "match_count": 5,
                        "filter_tender_id": request.tender_id,
                    },
                ).execute()
                if rpc_res.data:
                    context = "\n\n".join(
                        row["chunk_content"] for row in rpc_res.data
                    )
        except Exception as err:
            print(f"RAG search failed, falling back to document_text: {err}")

    if not context:
        context = request.document_text[:100_000]

    try:
        answer = gemini_client.ask_tender_question(
            document_text=context,
            question=request.question,
            history=request.history,
        )
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gonogo")
def evaluate_bidding_suitability(request: GoNoGoRequest):
    """
    Analyses a company's suitability (0-100 score) against the tender.
    """
    if not gemini_client:
        raise HTTPException(
            status_code=500,
            detail="Gemini API Client is not configured.",
        )
    try:
        evaluation = gemini_client.evaluate_go_nogo(
            analysis_result=request.analysis_result,
            company_profile=request.company_profile,
        )
        return evaluation
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
