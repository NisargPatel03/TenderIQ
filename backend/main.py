import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, BackgroundTasks
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
            .select("id,status,analysis_result,extracted_text,page_count,file_size,deadline,name,created_at")
            .eq("id", tender_id)
            .single()
            .execute()
        )
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    tender_id: str = Form(...),
    files: List[UploadFile] = File(default=[]),
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
):
    """
    Async upload endpoint for Render persistent server.
    Reads file bytes immediately, then returns 202 and schedules
    all heavy processing (AI analysis + embedding) as a background task.
    The frontend polls /api/tenders/{id}/status to track progress.
    """
    if not gemini_client:
        raise HTTPException(
            status_code=500,
            detail="Gemini API Client is not configured. Check backend environment variables.",
        )

    # ── Read file bytes NOW (UploadFile objects become invalid after response) ─
    files_data: List[tuple] = []
    all_files = list(files or [])
    if file:
        all_files.append(file)

    for f in all_files:
        data = await f.read()
        files_data.append((data, f.filename))

    # ── Schedule background processing and return 202 immediately ─────────────
    background_tasks.add_task(
        process_tender_background,
        tender_id=tender_id,
        files_data=files_data,
        raw_text=raw_text,
        authorization=authorization,
    )

    return {
        "status": "queued",
        "tender_id": tender_id,
        "message": "Tender queued for background processing. Poll /api/tenders/{id}/status for updates.",
    }


def process_tender_background(
    tender_id: str,
    files_data: List[tuple],
    raw_text: Optional[str],
    authorization: Optional[str],
):
    """
    Background worker — runs AFTER the 202 response is sent to the client.
    On Render (persistent server) this function runs to completion.
    """
    # ── 1. Text extraction ────────────────────────────────────────────────────
    extracted_text = ""
    page_count = 0
    file_size = 0

    try:
        if files_data:
            parts, total_pages, total_size = [], 0, 0
            for data, fname in files_data:
                total_size += len(data)
                f_text, f_pages = extract_content(data, fname)
                parts.append(
                    f"\n=========================================\n"
                    f"DOCUMENT: {fname}\n"
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
            _mark_failed(tender_id, authorization)
            print(f"[BG] No files or raw_text provided for tender {tender_id}")
            return

    except Exception as e:
        _mark_failed(tender_id, authorization)
        print(f"[BG] Text extraction failed for tender {tender_id}: {e}")
        return

    # ── 2. AI compliance analysis ─────────────────────────────────────────────
    try:
        print(f"[BG] Starting AI analysis for tender {tender_id}...")
        analysis = gemini_client.extract_tender_details(extracted_text)
        deadline = analysis.get("deadline")
        print(f"[BG] AI analysis complete for tender {tender_id}")
    except Exception as e:
        _mark_failed(tender_id, authorization)
        print(f"[BG] AI analysis failed for tender {tender_id}: {e}")
        return

    # ── 3. Update tender record to Active ─────────────────────────────────────
    try:
        supabase = get_supabase(authorization)
        supabase.table("tenders").update(
            {
                "status": "Active",
                "page_count": page_count,
                "file_size": file_size,
                "extracted_text": extracted_text[:100_000],
                "analysis_result": analysis,
                "deadline": deadline,
            }
        ).eq("id", tender_id).execute()
        print(f"[BG] Tender {tender_id} updated to Active")
    except Exception as e:
        print(f"[BG] DB update failed for tender {tender_id}: {e}")
        return

    # ── 4. RAG chunking & embeddings ─────────────────────────────────────────
    try:
        print(f"[BG] Starting RAG chunking for tender {tender_id}...")
        chunks = gemini_client.chunk_text(extracted_text)
        if chunks:
            print(f"[BG] Generating embeddings for {len(chunks)} chunks...")
            embeddings = gemini_client.generate_embeddings(chunks)

            # Delete old chunks for this tender before inserting fresh ones
            supabase.table("tender_chunks").delete().eq("tender_id", tender_id).execute()

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
                print(f"[BG] Inserted {len(payload)} chunks for tender {tender_id}")
    except Exception as e:
        # Chunking failure is non-fatal — tender is already Active
        print(f"[BG] RAG chunking skipped for tender {tender_id}: {e}")


def _mark_failed(tender_id: str, auth_header: Optional[str]):
    """Helper to update a tender row to Failed status on error."""
    try:
        supabase = get_supabase(auth_header)
        supabase.table("tenders").update({"status": "Failed"}).eq("id", tender_id).execute()
    except Exception as db_err:
        print(f"Could not mark tender {tender_id} as Failed: {db_err}")


@app.post("/api/qa")
def ask_question(
    request: QARequest, authorization: Optional[str] = Header(None)
):
    """
    Answers a free-form user query.
    Primary context: analysis_result (structured AI extraction) fetched from DB.
    Secondary context: pgvector RAG chunks.
    Final fallback: raw document_text from request body.
    """
    if not gemini_client:
        raise HTTPException(status_code=500, detail="Gemini API Client is not configured.")

    rag_context = ""
    analysis_result = None

    if request.tender_id:
        try:
            supabase = get_supabase(authorization)

            # Fetch structured analysis_result
            tender_row = (
                supabase.table("tenders")
                .select("analysis_result")
                .eq("id", request.tender_id)
                .single()
                .execute()
            )
            if tender_row.data:
                analysis_result = tender_row.data.get("analysis_result")

            # RAG vector search for supplementary chunks
            try:
                query_embeddings = gemini_client.generate_embeddings([request.question])
                if query_embeddings:
                    rpc_res = supabase.rpc(
                        "match_tender_chunks",
                        {
                            "query_embedding": query_embeddings[0],
                            "match_threshold": 0.25,
                            "match_count": 5,
                            "filter_tender_id": request.tender_id,
                        },
                    ).execute()
                    if rpc_res.data:
                        rag_context = "\n\n".join(
                            row["chunk_content"] for row in rpc_res.data
                        )
            except Exception as rag_err:
                print(f"RAG search skipped: {rag_err}")

        except Exception as err:
            print(f"Could not fetch tender data for QA: {err}")

    raw_context = rag_context or request.document_text[:80_000]

    try:
        answer = gemini_client.ask_tender_question(
            document_text=raw_context,
            question=request.question,
            history=request.history,
            analysis_result=analysis_result,
        )
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gonogo")
def evaluate_bidding_suitability(request: GoNoGoRequest):
    """Analyses a company's suitability (0-100 score) against the tender."""
    if not gemini_client:
        raise HTTPException(status_code=500, detail="Gemini API Client is not configured.")
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
