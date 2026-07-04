import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Header
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

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Gemini Client
try:
    gemini_client = GeminiClient()
except Exception as e:
    print(f"WARNING: Gemini client could not be initialized: {e}")
    gemini_client = None

# Supabase Client helper supporting both User Auth JWT header & server key fallback
def get_supabase_client(auth_header: Optional[str] = None) -> Client:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        raise ValueError("Supabase credentials (SUPABASE_URL & SUPABASE_KEY/ANON_KEY) are not set in the environment.")
    
    client = create_client(url, key)
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        client.postgrest.auth(token)
    return client

# Background Processing for Chunking, Embeddings, and AI Analysis
async def process_tender_background(
    tender_id: str,
    extracted_text: str,
    page_count: int,
    file_size: int,
    auth_header: Optional[str]
):
    try:
        supabase = get_supabase_client(auth_header)
        
        # 1. Chunk document text
        chunks = []
        if gemini_client and extracted_text:
            chunks = gemini_client.chunk_text(extracted_text)
            
        # 2. Generate embeddings in batches of 50
        if chunks and gemini_client:
            batch_size = 50
            embeddings = []
            for i in range(0, len(chunks), batch_size):
                batch = chunks[i:i+batch_size]
                batch_embeddings = gemini_client.generate_embeddings(batch)
                embeddings.extend(batch_embeddings)
                
            # 3. Store chunks and embeddings into database
            chunk_payload = []
            for idx, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                chunk_payload.append({
                    "tender_id": tender_id,
                    "chunk_content": chunk,
                    "page_number": idx + 1,
                    "embedding": emb
                })
            
            if chunk_payload:
                # Insert chunks
                supabase.table("tender_chunks").insert(chunk_payload).execute()
                
        # 4. Perform the full compliance AI analysis
        if gemini_client:
            analysis = gemini_client.extract_tender_details(extracted_text)
            deadline = analysis.get("deadline")
            
            # 5. Update the tender record status to Active
            supabase.table("tenders").update({
                "status": "Active",
                "page_count": page_count,
                "file_size": file_size,
                "extracted_text": extracted_text[:100000],  # Keep snippet to save DB space
                "analysis_result": analysis,
                "deadline": deadline
            }).eq("id", tender_id).execute()
            
    except Exception as e:
        print(f"Error in background task for tender {tender_id}: {e}")
        try:
            supabase = get_supabase_client(auth_header)
            supabase.table("tenders").update({
                "status": "Failed"
            }).eq("id", tender_id).execute()
        except Exception as db_err:
            print(f"Could not update status to Failed: {db_err}")

# Pydantic schemas for request validation
class QARequest(BaseModel):
    document_text: str
    question: str
    history: List[dict] = []
    tender_id: Optional[str] = None

class GoNoGoRequest(BaseModel):
    analysis_result: dict
    company_profile: str

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
            "gonogo": "/api/gonogo"
        }
    }

@app.get("/api/health")
def health_check():
    """Simple check to verify the API is running and the Gemini API Key is loaded."""
    api_key_loaded = os.environ.get("GEMINI_API_KEY") is not None
    return {
        "status": "healthy",
        "gemini_api_configured": api_key_loaded
    }

@app.get("/api/tenders/{tender_id}/status")
def get_tender_status(tender_id: str, authorization: Optional[str] = Header(None)):
    """Fetches the real-time status of a queued tender ingestion task."""
    try:
        supabase = get_supabase_client(authorization)
        res = supabase.table("tenders").select("status", "analysis_result", "extracted_text", "page_count", "file_size").eq("id", tender_id).single().execute()
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
    authorization: Optional[str] = Header(None)
):
    """
    Accepts document uploads/pasted text and schedules RAG chunking,
    embedding generation, and AI compliance analysis to run in the background.
    """
    if not gemini_client:
        raise HTTPException(
            status_code=500, 
            detail="Gemini API Client is not configured. Please check the backend .env file."
        )

    extracted_text = ""
    page_count = 0
    file_size = 0

    # 1. Text Extraction
    try:
        all_files = []
        if files:
            all_files.extend(files)
        if file:
            all_files.append(file)

        if all_files:
            extracted_parts = []
            total_pages = 0
            total_size = 0
            
            for f in all_files:
                file_bytes = await f.read()
                total_size += len(file_bytes)
                f_text, f_pages = extract_content(file_bytes, f.filename)
                
                part_header = f"\n=========================================\n" \
                              f"DOCUMENT: {f.filename}\n" \
                              f"=========================================\n\n"
                extracted_parts.append(part_header + f_text)
                total_pages += f_pages

            extracted_text = "\n".join(extracted_parts)
            page_count = total_pages
            file_size = total_size
        elif raw_text:
            extracted_text = raw_text.strip()
            file_size = len(extracted_text.encode("utf-8"))
            page_count = max(1, (len(extracted_text) // 3000) + 1)
        else:
            raise HTTPException(status_code=400, detail="Either a file upload or raw_text is required.")

    except ExtractionError as ee:
        raise HTTPException(status_code=400, detail=str(ee))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")

    # 2. Trigger asynchronous background process
    background_tasks.add_task(
        process_tender_background,
        tender_id=tender_id,
        extracted_text=extracted_text,
        page_count=page_count,
        file_size=file_size,
        auth_header=authorization
    )

    return {
        "status": "accepted",
        "tender_id": tender_id,
        "message": "Tender processing started in the background."
    }

@app.post("/api/qa")
def ask_question(request: QARequest, authorization: Optional[str] = Header(None)):
    """
    Answers a free-form user query using similarity search (RAG) context
    if tender_id is provided, falling back to full document text if needed.
    """
    if not gemini_client:
        raise HTTPException(
            status_code=500, 
            detail="Gemini API Client is not configured. Please check the backend .env file."
        )
    
    context = ""
    # If tender_id is provided, retrieve matching semantic chunks (RAG)
    if request.tender_id:
        try:
            supabase = get_supabase_client(authorization)
            
            # Generate query embedding
            query_embeddings = gemini_client.generate_embeddings([request.question])
            if query_embeddings:
                query_vector = query_embeddings[0]
                
                # Query similarity matches using match_tender_chunks RPC function
                rpc_response = supabase.rpc(
                    "match_tender_chunks",
                    {
                        "query_embedding": query_vector,
                        "match_threshold": 0.2,
                        "match_count": 5,
                        "filter_tender_id": request.tender_id
                    }
                ).execute()
                
                if rpc_response.data:
                    context = "\n\n".join([row["chunk_content"] for row in rpc_response.data])
        except Exception as err:
            print(f"RAG search failed, falling back to document_text: {err}")
            
    # Fallback to full document text if RAG yielded no context
    if not context:
        context = request.document_text[:1000000]
        
    try:
        answer = gemini_client.ask_tender_question(
            document_text=context,
            question=request.question,
            history=request.history
        )
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/gonogo")
def evaluate_bidding_suitability(request: GoNoGoRequest):
    """
    Analyzes a company's suitability score (0-100), matching criteria, and gaps 
    by comparing company profile details against the extracted tender parameters.
    """
    if not gemini_client:
        raise HTTPException(
            status_code=500, 
            detail="Gemini API Client is not configured. Please check the backend .env file."
        )
    
    try:
        evaluation = gemini_client.evaluate_go_nogo(
            analysis_result=request.analysis_result,
            company_profile=request.company_profile
        )
        return evaluation
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
