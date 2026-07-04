import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

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

# Pydantic schemas for request validation
class QARequest(BaseModel):
    document_text: str
    question: str
    history: List[dict] = []

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

@app.post("/api/upload")
async def upload_document(
    files: List[UploadFile] = File(default=[]),
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    filename: Optional[str] = Form(None)
):
    """
    Accepts single/multiple document files or raw text. Extracts text, merges
    if multiple, and triggers Gemini AI analysis to parse key sections.
    """
    if not gemini_client:
        raise HTTPException(
            status_code=500, 
            detail="Gemini API Client is not configured. Please check the backend .env file."
        )

    extracted_text = ""
    page_count = 0
    file_size = 0
    resolved_filename = filename or "pasted_text.txt"

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
            
            if len(all_files) == 1:
                resolved_filename = all_files[0].filename
            else:
                resolved_filename = f"Bidding Package ({len(all_files)} files)"
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

    # 2. AI Auto-Extraction
    try:
        analysis = gemini_client.extract_tender_details(extracted_text)
        return {
            "name": resolved_filename,
            "file_size": file_size,
            "page_count": page_count,
            "extracted_text": extracted_text,
            "analysis": analysis
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Gemini analysis extraction failed: {str(e)}"
        )

@app.post("/api/qa")
def ask_question(request: QARequest):
    """
    Answers a free-form user query based on the full tender document context.
    Also takes past conversation context to maintain history.
    """
    if not gemini_client:
        raise HTTPException(
            status_code=500, 
            detail="Gemini API Client is not configured. Please check the backend .env file."
        )
    
    try:
        answer = gemini_client.ask_tender_question(
            document_text=request.document_text,
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
