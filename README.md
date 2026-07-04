# TenderIQ - AI-Powered Procurement Intelligence

TenderIQ is a premium, enterprise-grade bidding intelligence dashboard built for corporate procurement professionals and bid managers. It uses **Google Gemini 2.5 Flash** to automatically parse, audit, and extract key insights from massive government and corporate RFP/tender documents (up to 500+ pages) in seconds.

---

## 🚀 Key Features

### 1. Document Ingestion & Folder Uploads
* **Multi-File Selection:** Ingests multiple files simultaneously, merging them with file boundary headers for unified compliance audits.
* **Direct Folder Uploads:** Select and upload entire directories (e.g. `work_313633`) using a hidden native `webkitdirectory` picker.
* **Recursive Drag-and-Drop:** Traverses nested folders on drop events, extracting supported `.pdf`, `.docx`, and `.txt` files while pruning system files like `.DS_Store`.
* **Direct Paste Area:** Quick capability to paste unstructured tender text directly for instant audits.

### 2. Multi-Section AI Compliance Engine
Auto-extracts and classifies 9 critical procurement check-points:
1. **Executive Summary:** Key goals, RFP references, and project overview.
2. **Eligibility Criteria:** Minimum years of experience, legal qualifications, and corporate credentials.
3. **Key Dates & Deadlines:** Submission windows, pre-bid conferences, and inquiry dates.
4. **Scope of Work:** Performance benchmarks, deliverables, and service parameters.
5. **Financial Requirements:** EMD/Bid security, bank guarantees, and minimum annual turnover.
6. **Required Documents Checklist:** Step-by-step checklist of forms, certs, and declarations.
7. **Risks & Penalties:** Liquidated damages, delay penalties, and liability limits.
8. **Evaluation Criteria:** Score weightings, quality-based selectors, and pass thresholds.
9. **Contact Details:** Authority emails, phone contacts, and procurement portals.

### 3. Split-Screen Tabbed Workspace (Obsidian-Style Layout)
* **Status-Aware Sidebar (Left):** Instant toggling between the 9 compliance cards with real-time indicators (Green dot for found parameters, Red dot for missing details).
* **Detail Card Viewer (Center):** Structured views for all compliance findings with glassmorphic designs.
* **Height Capping:** Restricts long checklists to a fixed height of `340px` with emerald WebKit scrollbars to maintain desktop layout grid alignment.
* **Live Search & Filter:** Dynamically filter long lists of clauses or documents in real-time.
* **Search-Aware Copying:** Copy only filtered items to the clipboard when active search queries are in place.

### 4. Interactive Q&A Bidding Assistant
* Chat with your RFP documents using context-aware questions.
* **Markdown Parser:** Renders answers with bold elements (`<strong>`) and bullet lists (`<ul>`/`<li>`) instead of raw markdown text.
* **Memory Sync:** Stores dialogue history in Supabase to persist user conversations.
* **Auto-Scroll:** Dynamically scrolls messages as answers stream in.

### 5. Suitability Go-NoGo Scorecard & Timeline
* **Go-NoGo Auditor:** Compares your company capabilities (turnover, experience) against extracted criteria to score suitability (0-100), listing strengths and compliance gaps.
* **Milestone Roadmap:** Dynamically parses extracted deadlines into a visual chronological timeline.

### 6. Premium Report Exporting
* **Export Word:** Generates and downloads clean, editable MS Word `.doc` files.
* **Export PDF (Clean Print Styles):** Media print styles (`@media print`) hide the sidebar menu, chat panel, mobile bar, and buttons. Adds a professional header showing the Tender Name, Generation Date, Bid Status, and Deadline, printing the 9 sections as a clean corporate PDF document.

---

## 🛠️ Technical Stack
* **Frontend:** React 18+, TypeScript, Vite, custom Vanilla CSS.
* **Backend:** FastAPI (Python 3.10+), Uvicorn, Google Gemini 2.5 Flash SDK, PyMuPDF, python-docx.
* **Database & Auth:** Supabase (PostgreSQL with Row-Level Security policies).

---

## ⚙️ Local Setup and Installation

### 1. Database Setup (Supabase)
1. Go to your **Supabase Dashboard** (project `uiyddkhhupzbwnpvsyfu`).
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

## 🚀 Production Deployment (Vercel Serverless)

TenderIQ is structured to deploy the frontend and backend as separate services on Vercel.

### Step 1: Deploy Backend (FastAPI Serverless)
1. Log in to [vercel.com](https://vercel.com) and click **Add New** > **Project**.
2. Import your GitHub repository.
3. In **Configure Project**:
   * **Project Name:** Set to `tenderiq-backend`.
   * **Root Directory:** Select the `backend` folder. (It uses the pre-configured `backend/vercel.json` file automatically).
4. Under **Environment Variables**, add the values from `backend/.env`:
   * `GEMINI_API_KEY`
   * `SUPABASE_URL`
   * `SUPABASE_KEY`
5. Click **Deploy**.
6. Once deployed, copy your backend deployment URL (e.g. `https://tenderiq-backend.vercel.app`).

### Step 2: Deploy Frontend (Vite Static Build)
1. Go to your Vercel Dashboard, click **Add New** > **Project**.
2. Import your GitHub repository.
3. In **Configure Project**:
   * **Project Name:** Set to `tenderiq-frontend`.
   * **Root Directory:** Select the `frontend` folder.
   * **Framework Preset:** Select **Vite**.
4. Under **Environment Variables**, add:
   * `VITE_SUPABASE_URL` = *(Your Supabase URL)*
   * `VITE_SUPABASE_ANON_KEY` = *(Your Supabase Anon Key)*
   * `VITE_API_URL` = *(Your live backend URL copied in Step 1)*
5. Click **Deploy**.

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
