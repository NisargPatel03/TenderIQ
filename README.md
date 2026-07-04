# TenderIQ - AI-Powered Procurement Intelligence

TenderIQ is a premium, enterprise-grade bidding intelligence dashboard built for corporate procurement professionals and bid managers. It uses Google Gemini 1.5 Flash to automatically parse, audit, and extract key insights from massive government and corporate RFP/tender documents (up to 500+ pages) in seconds.

---

## 🚀 Key Features

### 1. Document Upload & Extraction
* **Multi-Format Support:** Drag-and-drop or select PDF, DOCX, or TXT documents.
* **Direct Pasting:** Paste raw tender text directly into a text area.
* **Page & Size Previews:** Real-time upload metadata and progress visualization.

### 2. Multi-Section AI Auto-Extraction
Extracts and isolates 9 critical compliance areas, including:
1. **Executive Summary:** High-level overview of the tender.
2. **Eligibility Criteria:** Bidder qualification checkpoints.
3. **Key Dates & Deadlines:** Submission windows and meeting dates.
4. **Scope of Work:** Delivery instructions and technical specifications.
5. **Financial Requirements:** Minimum turnovers and EMD/bid security values.
6. **Required Documents Checklist:** Checklist of certificates, forms, and credentials.
7. **Risks & Penalties:** Liquidated damages and liability limits.
8. **Evaluation Criteria:** Score weights and technical scoring methods.
9. **Contact Details:** Authority emails, phone numbers, and portals.

### 3. Chronological Timeline Visualizer
* Translates extracted deadlines into a visual timeline roadmap.
* Chronologically sorts milestones to ensure no bid pre-meetings or submissions are missed.

### 4. Interactive Go-NoGo Scorecard
* Audits your company capabilities against tender requirements.
* Paste your corporate profile (turnover, certifications, experience) to receive an AI suitability score (0-100), strength lists, and compliance gaps.

### 5. Contextual Q&A Bidding Assistant
* Chat with the document using free-form follow-up questions.
* Uses conversation memory and stores past dialogues in Supabase for persistence.

### 6. Professional Report Exporting
* **Export Word:** Formats and downloads compliance audit summaries as editable MS Word `.doc` files.
* **Export PDF:** Triggers a print-ready custom layout to print or save reports.

---

## 🛠️ Technical Stack
* **Frontend:** React, TypeScript, Vite, custom Vanilla CSS.
* **Backend:** FastAPI (Python), Uvicorn, Google Gemini 1.5 Flash SDK, PyMuPDF, python-docx.
* **Database & Auth:** Supabase (PostgreSQL with Row-Level Security policies).

---

## ⚙️ Local Setup and Installation

### 1. Database Setup (Supabase)
1. Go to your **Supabase Dashboard** (for project `uiyddkhhupzbwnpvsyfu`).
2. Open the **SQL Editor**, click **New Query**, paste the contents of `schema.sql`, and click **Run**.
3. Go to **Authentication** -> **Providers** -> **Email** and disable **Confirm email** for easy local testing.

### 2. Backend Installation & Run
1. Navigate to the root directory:
   ```bash
   cd TenderIQ
   ```
2. Set up virtual environment and install packages:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r backend/requirements.txt
   ```
3. Set your Gemini API key in `backend/.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. Start the server:
   ```bash
   .\venv\Scripts\python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000
   ```

### 3. Frontend Installation & Run
1. Open a new terminal in the `frontend` folder:
   ```bash
   cd frontend
   npm install
   ```
2. Configure credentials in `frontend/.env`:
   ```env
   VITE_SUPABASE_URL=https://uiyddkhhupzbwnpvsyfu.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   VITE_API_URL=http://localhost:8000
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open the application in your browser: `http://localhost:5173/`

---

## 🗺️ Roadmap: Features Remaining to Add

The following features represent future enhancements and functional items left to build:

### 1. Scanned Document OCR Fallback
* Integration with an OCR engine (e.g., PyTesseract, EasyOCR, or Google Cloud Vision API) to extract text from scanned, image-only PDFs that contain no digital text.
* Currently, the system raises a graceful `ExtractionError` for scanned files.

### 2. Comparative Tender Analytics Matrix
* A side-by-side comparison matrix panel that allows bid managers to select multiple uploaded tenders and compare their financial turnovers, EMD securities, and submission dates in a tabular comparison layout.

### 3. Automated Bid Team Collaboration
* A shared comment thread or discussion board on the sidebar, allowing team members to review Scorecards, add comments, and flag risks.
* Multi-user assignment workflow where bids can be marked as "Under Legal Review", "Technical Review", or "Approved to Bid".

### 4. Direct Email & Chat Integration Notifications
* Automatic slack alerts, discord webhooks, or email notifications sent to bid teams when a critical milestone or deadline (e.g., Pre-bid meeting) is approaching.

### 5. AI Bid Writing Assistant
* Draft standard response documents, cover letters, and capability matrices based on the extracted scope of work and eligibility requirements directly from the interface.
