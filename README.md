# TenderIQ — AI-Powered Procurement Intelligence Platform

> **Enterprise-grade bidding intelligence dashboard** built for corporate procurement professionals and bid managers. Uses **Google Gemini 2.5 Flash** and a **pgvector RAG pipeline** to automatically parse, audit, and extract key compliance insights from massive government and corporate RFP/tender documents (up to 1,000+ pages) in seconds.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Architecture](#architecture)
4. [Technical Stack](#technical-stack)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Local Setup & Installation](#local-setup--installation)
8. [Production Deployment (Vercel)](#production-deployment-vercel)
9. [Environment Variables](#environment-variables)
10. [Roadmap](#roadmap)

---

## Overview

TenderIQ solves a critical enterprise bottleneck: procurement teams waste dozens of hours manually reading 500–1,000 page RFP documents to extract eligibility criteria, deadlines, financial requirements, and risks. TenderIQ ingests the full document package, runs a multi-section AI compliance audit in seconds, and gives teams a live Q&A assistant to interrogate the tender like a document expert.

### How It Works (End-to-End Pipeline)

```
User uploads PDF/DOCX/TXT files or a folder
           ↓
Frontend creates a 'Processing' tender record in Supabase
           ↓
FastAPI backend extracts raw text from all documents
           ↓
Gemini 2.5 Flash runs 9-section compliance analysis
           ↓
Text is chunked (sliding window) + embeddings generated
           ↓
Chunks + embeddings stored in Supabase pgvector table
           ↓
Tender status updated to 'Active' in database
           ↓
Frontend auto-refreshes → shows full compliance dashboard
```

---

## Key Features

### 1. 📁 Multi-Document Ingestion Engine

| Capability | Detail |
|---|---|
| **Multi-file selection** | Select multiple PDFs/DOCX/TXT simultaneously — merged with file-boundary headers for unified audit |
| **Folder upload** | Upload entire project directories via native `webkitdirectory` picker |
| **Recursive drag-and-drop** | Drop nested folders; engine traverses subdirectories extracting valid files, skipping system artifacts (`.DS_Store`, `__MACOSX`) |
| **Raw text paste** | Paste unstructured tender text directly — auto-calculates page estimate |
| **Format support** | `.pdf` (PyMuPDF), `.docx` (python-docx), `.txt` (UTF-8/Latin-1 fallback) |
| **File size display** | Shows human-readable sizes (KB/MB) in sidebar |

---

### 2. 🤖 9-Section AI Compliance Engine

Auto-extracts and classifies 9 critical procurement checkpoints from every tender package:

| # | Section | What it extracts |
|---|---|---|
| 1 | **Executive Summary** | Project goals, RFP reference numbers, project overview |
| 2 | **Eligibility Criteria** | Min. years experience, legal qualifications, corporate credentials |
| 3 | **Key Dates & Deadlines** | Submission windows, pre-bid conferences, query deadlines |
| 4 | **Scope of Work** | Performance benchmarks, deliverables, service parameters |
| 5 | **Financial Requirements** | EMD/bid security amounts, bank guarantees, annual turnover minimums |
| 6 | **Required Documents Checklist** | Forms, certificates, declarations needed |
| 7 | **Risks & Penalties** | Liquidated damages, delay penalties, liability caps |
| 8 | **Evaluation Criteria** | Score weightings, quality-based selectors, pass/fail thresholds |
| 9 | **Contact Details** | Authority emails, phone contacts, procurement portal URLs |

Each section returns a **found/not-found indicator** with a green or red dot in the sidebar navigation.

---

### 3. 🔍 RAG Vector Search (Retrieval-Augmented Generation)

TenderIQ implements a full **pgvector RAG pipeline** to handle massive 1,000+ page documents:

- **Text Chunking:** Documents are split using a sliding-window algorithm (1,500 char chunks with 300-char overlap) preserving paragraph context.
- **Embeddings:** Each chunk is converted to a 768-dimension vector using the official Google GenerativeAI SDK and the `models/gemini-embedding-001` model with batching optimization (processing in groups of 100 with a 0.5s rate-limit delay to prevent 429 quota errors).
- **Storage:** Vectors stored in Supabase `tender_chunks` table with `pgvector` extension.
- **Semantic Search:** When a user asks a chat question, an embedding is generated for the query and a **cosine similarity search** (`match_tender_chunks` RPC) retrieves the top 5 most relevant paragraphs.
- **3-Layer Context:** QA engine uses `analysis_result` (primary) → RAG chunks (secondary) → raw text fallback (tertiary).
- **Cost Efficiency:** Reduces Gemini token usage by up to 95% vs. sending full document text.

---

### 4. ⚡ Asynchronous Processing & Status Lifecycle

Tenders have a full status lifecycle managed between the frontend and backend:

```
Processing → Active → Submitted → Expired
                   ↘ Failed (on backend error)
```

| Status | Badge | Meaning |
|---|---|---|
| `Processing` | 🟡 Pulsing amber | Backend is extracting, analyzing, and embedding the document |
| `Active` | 🟢 Green | Analysis complete — full workspace available |
| `Submitted` | 🔵 Blue | Manually marked as bid submitted |
| `Expired` | 🔴 Red | Manually marked as past deadline |
| `Failed` | 🔴 Red | Backend encountered an error — remove and re-upload |

**Processing Workspace State:** While a tender is being analyzed, clicking it shows a premium glassmorphic spinner card with an animated progress bar.

**Failed Workspace State:** Shows a dedicated error card with a "Remove Record" button to clean up the failed entry.

---

### 5. 💬 Context-Aware Q&A Bidding Assistant

The right-panel chatbot can answer any free-form question about the active tender:

- **Primary context:** Uses the AI-extracted `analysis_result` JSON (all 9 sections) as its knowledge base — always accurate regardless of document size
- **RAG augmentation:** Fetches semantically relevant raw text chunks via pgvector for granular questions
- **Chat history:** Sends last 5 turns of conversation to Gemini for contextual follow-up questions
- **Persistent history:** All Q&A pairs stored in Supabase `tender_qa` table, reloaded on revisit
- **Markdown rendering:** Answers render with `**bold**` and `- bullet` formatting, not raw text
- **Auto-scroll:** Chat panel scrolls smoothly as answers arrive
- **Supabase JWT passthrough:** Auth token sent to backend so RLS policies scope data per-user

---

### 6. 🎯 Go/No-Go Suitability Scorecard

The **Go/No-Go** tab allows bid managers to evaluate whether their company should bid:

1. Enter company profile (turnover, certifications, past experience)
2. AI performs a GAP analysis against extracted eligibility and financial requirements
3. Returns a **suitability score (0–100)**, `Go` / `No-Go` / `Proceed with Caution` decision
4. Lists specific **matching qualifications** and **compliance gaps**
5. Provides a strategic 3–4 sentence executive recommendation

---

### 7. 📅 Milestone Timeline Visualizer

The **Timeline** tab parses extracted `key_dates` into a visual chronological milestone roadmap:

- Renders each deadline as a timeline node with date and label
- Color-coded urgency indicators (upcoming vs. past deadlines)
- Works from the AI-extracted structured data — no manual input needed

---

### 8. 📊 Procurement Intelligence Dashboard

The home screen (before selecting a tender) shows live workspace metrics:

| Metric | Source |
|---|---|
| **Total Tenders Audited** | Count of all tender records in DB |
| **Active Bid Pursuits** | Count of `status = 'Active'` tenders |
| **Submitted Proposals** | Count of `status = 'Submitted'` tenders |

---

### 9. 🗂️ Sidebar Tender Management

| Feature | Detail |
|---|---|
| **Search** | Real-time fuzzy search by tender name |
| **Status filter** | Filter tabs: All / Active / Submitted / Expired |
| **Delete with confirmation** | Hover-reveal trash icon triggers a modal confirmation dialog before deletion |
| **Status badges** | Color-coded pill badges with pulsing animation for Processing state |
| **File size & date** | Shows document size and upload date below tender name |
| **Tender lifecycle selector** | In-workspace dropdown to manually move tender between Active → Submitted → Expired |

---

### 10. 🔔 Notification System

A global `NotificationProvider` wraps the application with robust notification channels:

- **Toast notifications:** Transient success/error/info messages that auto-dismiss.
- **Confirm dialogs:** Modal confirmation prompts for destructive actions (delete, sign out) with `isDanger` red styling option.
- **Real-Time Mention Tagging and Badges:** Tracks comments referencing the current user across the entire workspace in real-time. Highlights tagged sections with counter badges in the sidebar, adds pulsing gold notification dots to tagged clause comment triggers, and fires toast alerts even if the comment drawer is closed. Automatically updates counts and clears badges upon opening the drawer.

---

### 11. 📄 Report Exporting

| Export Type | Detail |
|---|---|
| **Word Document (.doc)** | Generates a clean, editable Word-compatible file of all 9 sections |
| **PDF (Print Styles)** | `@media print` CSS hides sidebar, chatbot, nav buttons — adds a professional header with Tender Name, Generation Date, Status, and Deadline. Prints the 9 compliance sections as a corporate PDF |
| **Copy to Clipboard** | Per-section copy button; copies only filtered results when search is active |

---

### 12. 📱 Mobile Responsive Layout

- **Mobile top bar:** TenderIQ branding + hamburger menu button
- **Sidebar drawer:** Slides in from left on mobile with a full-screen backdrop overlay
- **Auto-close:** Drawer closes automatically on tender selection or "Analyze New Tender" click
- **Breakpoint:** Responsive layout switches at `768px` viewport width
- **Horizontal Tab Slide:** Horizontal layout tabs (Analysis, Timeline, Scorecard, Proposal Writer) scroll smoothly with a hidden scrollbar on mobile viewports, avoiding text overflow and layout breaks.

---

### 13. 🎉 UX Micro-Interactions

- **Confetti explosion** (`canvas-confetti`) fires when a tender analysis completes successfully
- **Section navigation dot indicators** (green/red) update as you switch compliance cards
- **Hover-reveal delete buttons** in sidebar (opacity transition from 0 → 1)
- **Animated progress bar** during upload with descriptive status text messages
- **Loading dots animation** during initial session load

---

### 14. 🤝 Collaborative Team Workspaces & Roles

Procurement is a team sport. TenderIQ provides a full workspace management interface:
- **Workspace Switcher:** Easily switch between personal and shared team workspaces.
- **Auto-Initialization:** New sign-ups are automatically allocated a personal workspace to start immediately.
- **Role-Based Membership:** Assign invited members specific workspace roles (e.g. *Legal Auditor*, *Technical Reviewer*, *Bid Manager*) that determine their permissions.
- **Team Management Console:** Owners and Admins can invite teammates by email, view active memberships, and revoke access inside the settings modal.

---

### 15. 💬 Real-Time Clause-Level Comment Threads

Teammates can collaborate directly on specific compliance clauses:
- **Localized Feeds:** Expanded comment drawer next to every compliance check, criteria list, or required document.
- **Real-Time Sync:** Subscribed to Supabase realtime channels so comments, edits, and deletions sync instantly across all user screens without page reloads.
- **Teammate Mentions:** Tag members using `@email_address` format, which highlights their tags in a custom bubble and triggers instant desktop toast notifications.

---

### 16. 📋 Multi-User Kanban Bid Board

Track procurement proposals through a unified team lifecycle:
- **Visual Lifecycles:** Kanban board displays tenders grouped into 5 stages: *Discovered*, *Under Audit*, *Approved to Bid*, *Writing Proposal*, and *Submitted*.
- **Drag-and-Drop / Move Buttons:** Easy touch/mouse drag cards or click navigation arrows to transition tenders between stages.
- **Instant Persistence:** Stage movements persist immediately to database records for all workspace members.

---

### 17. 🤖 Auto-Bid Proposal Writer (The Killer Feature)

Once compliance requirements are extracted, the next business challenge is actually writing the proposal response document. TenderIQ automates this:
- **Reference Library:** Lets users upload previous winning proposals, resumes, and company descriptions as a reference library for each organization.
- **AI Proposal Compiler:** The engine automatically correlates the active tender's Scope of Work and Technical Requirements with company credentials.
- **Stepped Compiler Progress:** Displays a real-time compilation visualizer that breaks down the synthesis phases.
- **Interactive Previewer:** Preview draft sections (Cover Letter, Technical Response, Compliance Matrix) directly inside the workspace tab.
- **Styled MS Word Download (.docx):** Downloads the bid response in a fully styled, beautifully formatted Word document with custom tables and structural headers.

---

### 18. 📡 Automated RFP Lead Discovery & Matching
TenderIQ automates early-stage procurement lead generation by crawling public tenders and evaluating bid compatibility:
- **Intelligent Portal Scraper:** Simulates real-time crawling of procurement feeds (CPPP & GeM) using current system date offsets so bid due-dates remain future-dated.
- **Smart Matching Matrix:** Uses Gemini 2.5 Flash to automatically compare scraped lead requirements against user-defined corporate capability profiles and keywords.
- **Dynamic Glassmorphic Scanning UI:** Visual radar scanning overlay displaying connecting, scraping, keyword matching, and AI scoring stages to keep the user engaged.
- **Slack Alert Integrations:** Configurable webhook alerts that automatically broadcast high-compatibility opportunities (e.g., >70% match score) to your team's Slack channels.
- **Instant Workspace Import:** Import a lead directly into your workspace. To resolve the lack of full document details on portal search lists, the backend uses a **Tender Specification Expander** to automatically generate a rich, 2,000-word tender specification document containing technical terms, eligibility requirements, milestones, payment schedules, and liability clauses. This allows you to immediately test the auditing system, chatbot, and proposal writer on the imported lead.

---

### 19. 🎙️ Executive Audio Briefings ("Podcast" Mode)
Busy executives and bid managers can consume tender reviews on the go:
- **Generative Podcast Script:** Synthesizes a two-host conversational script (Host A: Bidding Strategist, Host B: Lead Auditor) discussing the active tender's overview, qualification checks, key deadlines, and liability risks.
- **Generative Text-to-Speech (TTS):** Converts the script into a high-quality playable audio file (`briefing.mp3`) using state-of-the-art text-to-speech rendering.
- **Integrated Audio Player:** Direct in-app player widget featuring play/pause controls, skip buttons, simulated audio waveform, and download capability.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vite + React)                   │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────┐  │
│  │ Sidebar  │  │ TenderDetail │  │  ChatBot │  │UploadZ │  │
│  │ (Tender  │  │ (9 sections  │  │  (Q&A +  │  │  one   │  │
│  │  List)   │  │  + GoNoGo +  │  │  RAG)    │  │(Upload)│  │
│  │          │  │  Timeline)   │  │          │  │        │  │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └───┬────┘  │
│       │               │               │             │       │
│       └───────────────┴───────────────┴─────────────┘       │
│                        Supabase Client (JS)                  │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS + JWT Auth Header
┌────────────────────────────▼────────────────────────────────┐
│                   BACKEND (FastAPI + Uvicorn)                │
│                    Vercel Serverless Function                 │
│                                                             │
│  POST /api/upload  →  Extract → Analyze → Chunk → Embed     │
│  POST /api/qa      →  Fetch analysis_result → RAG → Gemini  │
│  POST /api/gonogo  →  GAP analysis → Score → Decision       │
│  GET  /api/health  →  Status check                          │
│  GET  /api/tenders/{id}/status → Polling endpoint           │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                        SUPABASE                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │   tenders    │  │  tender_qa   │  │  tender_chunks     │ │
│  │  (analysis,  │  │  (chat hist) │  │  (text + vectors   │ │
│  │   status)    │  │              │  │   for RAG search)  │ │
│  └──────────────┘  └──────────────┘  └────────────────────┘ │
│                   Row-Level Security on all tables           │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18+ | UI component framework |
| TypeScript | 5+ | Type-safe development |
| Vite | 8+ | Build tool and dev server |
| Vanilla CSS | — | Custom design system, glassmorphism, animations |
| Supabase JS | 2+ | Auth, database client |
| canvas-confetti | — | Upload success animation |
| lucide-react | — | Icon library |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.111 | REST API framework |
| Uvicorn | 0.30 | ASGI server |
| Google Generative AI | 0.7.2 | Gemini 2.5 Flash (analysis) + embedding-001 (RAG) |
| PyMuPDF | 1.24 | PDF text extraction |
| python-docx | 1.1 | DOCX text extraction |
| supabase-py | 2.5 | Database client + auth |
| python-dotenv | 1.0 | Environment variable loading |
| pydantic | 2.7 | Request body validation |

### Infrastructure
| Service | Purpose |
|---|---|
| Supabase | PostgreSQL database, Auth (JWT), Row-Level Security, pgvector extension |
| Vercel (Backend) | Python serverless function hosting |
| Vercel (Frontend) | Static SPA hosting with CDN |
| GitHub | Source control + Vercel auto-deploy trigger |

---

## Database Schema

Run the full `schema.sql` file in your Supabase SQL editor. It creates:

### `public.tenders`
```sql
id              UUID PRIMARY KEY
user_id         UUID → auth.users
org_id          UUID → public.organizations (nullable)
name            TEXT
status          TEXT CHECK IN ('Active','Submitted','Expired','Processing','Failed')
kanban_stage    TEXT DEFAULT 'Discovered' CHECK IN ('Discovered','Under Audit','Approved to Bid','Writing Proposal','Submitted')
deadline        TIMESTAMP WITH TIME ZONE
file_size       BIGINT
page_count      INT
extracted_text  TEXT          -- First 100K chars of document
analysis_result JSONB        -- Full 9-section AI extraction
created_at      TIMESTAMP
```

### `public.tender_qa`
```sql
id          UUID PRIMARY KEY
tender_id   UUID → tenders
user_id     UUID → auth.users
question    TEXT
answer      TEXT
created_at  TIMESTAMP
```

### `public.tender_chunks` *(RAG Vector Store)*
```sql
id            UUID PRIMARY KEY
tender_id     UUID → tenders (ON DELETE CASCADE)
chunk_content TEXT
page_number   INT
embedding     vector(768)   -- Google gemini-embedding-001 dimensions
created_at    TIMESTAMP
```

### `public.organizations`
```sql
id          UUID PRIMARY KEY
name        TEXT
owner_id    UUID → auth.users
created_at  TIMESTAMP
```

### `public.org_members`
```sql
id          UUID PRIMARY KEY
org_id      UUID → public.organizations
user_id     UUID → auth.users
user_email  TEXT
role        TEXT CHECK IN ('Owner', 'Admin', 'Legal Auditor', 'Technical Reviewer', 'Bid Manager')
created_at  TIMESTAMP
```

### `public.clause_comments`
```sql
id            UUID PRIMARY KEY
tender_id     UUID → tenders
section_key   TEXT
clause_text   TEXT
user_id       UUID → auth.users
user_email    TEXT
comment_text  TEXT
created_at    TIMESTAMP
```

### `public.workspace_references`
```sql
id            UUID PRIMARY KEY
org_id        UUID → public.organizations (ON DELETE CASCADE)
user_id       UUID → auth.users (ON DELETE SET NULL)
filename      TEXT
file_size     BIGINT
content_text  TEXT
created_at    TIMESTAMP WITH TIME ZONE
```


### PostgreSQL Helper & Security Definer Functions
- **`match_tender_chunks`**: Cosine similarity matching:
  ```sql
  match_tender_chunks(
    query_embedding  vector(768),
    match_threshold  float,        -- minimum similarity (0.25 default)
    match_count      int,          -- top N results (5 default)
    filter_tender_id uuid
  ) RETURNS TABLE(id, chunk_content, page_number, similarity)
  ```
- **`is_org_member(org_id, user_uuid)`**: Checks if user is a member/owner of the organization without causing RLS recursion.
- **`is_org_admin(org_id, user_uuid)`**: Checks if user has owner/admin privileges in the organization.
- **`get_user_id_by_email(email_addr)`**: Returns user UUID for a registered email (used for organization invites).

All tables have **Row-Level Security (RLS)** policies enabled, scoped per-user and per-organization to enforce strict multi-tenancy isolation.

---

## API Reference

Base URL (local): `http://127.0.0.1:8000`  
Base URL (production): `https://tenderiq-backend.vercel.app`

### `GET /api/health`
Returns server health and configuration status.
```json
{ "status": "healthy", "gemini_api_configured": true, "supabase_configured": true }
```

### `POST /api/upload`
Accepts document files or raw text, extracts content, runs AI analysis, generates embeddings, and updates the tender record.

**Form Data:**
| Field | Type | Required |
|---|---|---|
| `tender_id` | string (UUID) | ✅ |
| `files` | File[] | Either `files` or `raw_text` |
| `raw_text` | string | Either `files` or `raw_text` |

**Headers:** `Authorization: Bearer <supabase_jwt>`

**Response:**
```json
{ "status": "completed", "tender_id": "uuid", "message": "Tender processed and saved successfully." }
```

### `POST /api/qa`
Answers a free-form question using structured analysis + RAG context.

**Body:**
```json
{
  "document_text": "fallback raw text",
  "question": "What are the key deadlines?",
  "history": [{ "question": "...", "answer": "..." }],
  "tender_id": "uuid"
}
```

**Response:** `{ "answer": "markdown formatted answer" }`

### `POST /api/gonogo`
Evaluates bid suitability against company profile.

**Body:**
```json
{
  "analysis_result": { ...9_section_json... },
  "company_profile": "Turnover: ₹50Cr, Experience: 10 years..."
}
```

**Response:**
```json
{
  "score": 78,
  "decision": "Go",
  "matches": ["Meets turnover requirement", "..."],
  "gaps": ["Missing ISO certification", "..."],
  "explanation": "Strategic summary..."
}
```

### `GET /api/tenders/{tender_id}/status`
Polls a tender's current processing status and returns its data fields.

**Headers:** `Authorization: Bearer <supabase_jwt>`

### `POST /api/references/upload`
Uploads reference material (winning proposals, resumes, company profiles), extracts its text, and saves it to the reference library.

**Form Data:**
| Field | Type | Required |
|---|---|---|
| `org_id` | string (UUID) | ✅ |
| `file` | File | ✅ (PDF/DOCX/TXT) |

**Headers:** `Authorization: Bearer <supabase_jwt>`

### `POST /api/proposal/draft`
Generates a structured, professional proposal response JSON (Cover Letter, Technical Response, and Capability Matrix) by compiling selected references and active tender requirements.

**Body:**
```json
{
  "tender_id": "uuid",
  "org_id": "uuid",
  "custom_instructions": "e.g. Highlight ISO 27001",
  "reference_ids": ["uuid_1", "uuid_2"]
}
```

**Headers:** `Authorization: Bearer <supabase_jwt>`

**Response:**
```json
{
  "cover_letter": "formatted text",
  "technical_response": "formatted text",
  "capability_matrix": [
    {
      "requirement": "string",
      "compliance_status": "string",
      "evidence_reference": "string"
    }
  ]
}
```

### `POST /api/proposal/download`
Builds and styles a Word document (`.docx`) using the JSON draft details, and returns the file stream.

**Body:**
```json
{
  "tender_name": "Tender Title",
  "draft": {
    "cover_letter": "...",
    "technical_response": "...",
    "capability_matrix": [...]
  }
}
```

**Response:** Binary Stream (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)

### `GET /api/leads/settings`
Fetches the organization's automated lead matching settings and preferences.

**Query Parameters:**
- `org_id` (string, UUID): The target organization's ID.

**Headers:** `Authorization: Bearer <supabase_jwt>`

**Response:**
```json
{
  "company_profile": "Turnover: ₹50Cr, Experience: 10 years...",
  "alert_keywords": "transformer, substation, grid",
  "slack_webhook": "https://hooks.slack.com/services/..."
}
```

### `POST /api/leads/settings`
Saves the organization's automated lead matching settings and preferences.

**Body:**
```json
{
  "org_id": "uuid",
  "company_profile": "...",
  "alert_keywords": "keyword1, keyword2",
  "slack_webhook": "..."
}
```

**Headers:** `Authorization: Bearer <supabase_jwt>`

**Response:** `{ "status": "success", "data": { ... } }`

### `GET /api/leads`
Lists all crawled and simulated RFP leads matched for the organization.

**Query Parameters:**
- `org_id` (string, UUID): The target organization's ID.

**Headers:** `Authorization: Bearer <supabase_jwt>`

**Response:** Array of matched lead objects.

### `POST /api/leads/crawl`
Triggers simulated portal scraping of government feeds, evaluates suitability scores, inserts matched results, and broadcasts high-compatibility alerts to Slack.

**Body:**
```json
{
  "org_id": "uuid"
}
```

**Headers:** `Authorization: Bearer <supabase_jwt>`

**Response:**
```json
{
  "status": "success",
  "new_matches_count": 3,
  "matches": [...]
}
```

### `POST /api/leads/{lead_id}/import`
Imports a discovered lead into the active workspace, scheduling a background spec-expansion step (converting short summaries to detailed 2000-word RFPs) followed by a 9-section compliance audit.

**Headers:** `Authorization: Bearer <supabase_jwt>`

**Response:**
```json
{
  "status": "success",
  "tender_id": "uuid",
  "message": "Lead imported successfully. Running background compliance analysis."
}
```

### `POST /api/tenders/audio-brief`
Generates a two-host conversational podcast summary of a tender and streams it back as an MP3 file.

**Body:**
```json
{
  "tender_id": "uuid"
}
```

**Headers:** `Authorization: Bearer <supabase_jwt>`

**Response:** Binary Stream (`audio/mpeg`)

---

## Local Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- A Supabase project (free tier works)
- A Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey))

---

### Step 1: Database Setup (Supabase)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Open the **SQL Editor** → click **New Query**
3. Paste the full contents of `schema.sql` and click **Run**
4. Go to **Authentication → Providers → Email** and **disable "Confirm email"** for local testing

> **Important for RAG:** If you've already created the tenders table without the new status values, run this migration in the SQL editor:
> ```sql
> ALTER TABLE public.tenders DROP CONSTRAINT IF EXISTS tenders_status_check;
> ALTER TABLE public.tenders ADD CONSTRAINT tenders_status_check
>   CHECK (status IN ('Active', 'Submitted', 'Expired', 'Processing', 'Failed'));
> ALTER TABLE public.tenders ALTER COLUMN status SET DEFAULT 'Processing';
> ```

---

### Step 2: Backend Setup

```bash
# From the project root
python -m venv venv
.\venv\Scripts\activate          # Windows
# source venv/bin/activate       # macOS/Linux

pip install -r backend/requirements.txt
```

Create `backend/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Start the backend server:
```bash
.\venv\Scripts\python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

The `--reload` flag enables auto-restart when source files change.

---

### Step 3: Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_API_URL=http://localhost:8000
```

Start the development server:
```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

### Stopping the Backend (Windows PowerShell)

If port 8000 is already in use:
```powershell
# Find the PID
netstat -ano | findstr ":8000"

# Kill it (replace 12345 with actual PID)
taskkill /PID 12345 /F
```

---

## Production Deployment (Vercel)

TenderIQ is structured for split-service deployment — backend and frontend as separate Vercel projects.

### Step 1: Deploy Backend (FastAPI Serverless)

1. Log in to [vercel.com](https://vercel.com) → **Add New → Project**
2. Import your GitHub repository
3. In **Configure Project**:
   - **Project Name:** `tenderiq-backend`
   - **Root Directory:** `backend` *(Vercel uses `backend/vercel.json` automatically)*
4. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `GEMINI_API_KEY` | Your Gemini API key |
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_ANON_KEY` | Your Supabase anon key |
5. Click **Deploy**
6. Copy your deployment URL (e.g., `https://tenderiq-backend.vercel.app`)

> **CORS:** The `backend/vercel.json` injects `Access-Control-Allow-Origin` headers at the Vercel edge layer as a dual-layer defence alongside FastAPI's CORSMiddleware.

### Step 2: Deploy Frontend (Vite Static Build)

1. **Add New → Project** → Import the same GitHub repository
2. In **Configure Project**:
   - **Project Name:** `tenderiq-frontend`
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
3. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
   | `VITE_API_URL` | Your backend URL from Step 1 (no trailing slash) |
4. Click **Deploy**

### Auto-Deploy
Every `git push` to the `main` branch triggers automatic rebuilds on both Vercel projects.

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key for AI analysis and embeddings |
| `SUPABASE_URL` | ✅ | Supabase project REST URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anonymous public key |

### Frontend (`frontend/.env`)
| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project REST URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous public key |
| `VITE_API_URL` | ✅ | Backend API base URL (no trailing slash) |

---

## Roadmap

The following features represent planned future enhancements and accomplishments:

### 1. 🔭 Scanned Document OCR Support
- Integration with PyTesseract, EasyOCR, or Google Cloud Vision API to handle image-only (scanned) PDFs
- Currently, the parser raises a graceful `ExtractionError` for non-digital PDFs with no extractable text

### 2. 📊 Comparative Tender Analytics Matrix
- Side-by-side comparison panel for multiple uploaded tenders
- Compare EMD securities, turnover requirements, submission deadlines, and scope size in a tabular layout
- Export comparison matrices as CSV or PDF

### 3. 🤝 Bid Team Collaboration Workspace (Completed ✅)
- Shared comment thread on each tender for team review and discussion
- Multi-user assignment workflow: mark bids as "Under Legal Review", "Technical Review", or "Approved to Bid"
- Role-based access control (Admin, Reviewer, Viewer)

### 4. 🔔 Deadline Notification Webhook Alerts (Completed ✅)
- Slack webhook alert notifications automatically broadcast when a high-compatibility matched lead (>70% score) is crawled and matched from government portals.
- Configurable settings panel for workspace-wide Slack Webhook URLs.

### 5. ✍️ AI Bid Writing Assistant (Completed ✅)
- Auto-draft Cover Letters, Technical Responses, and Compliance Matrices.
- Custom instructions capability, stepped compiler animations, live rich-text previewer, and formatted DOCX export.

### 6. 📈 Analytics Dashboard
- Historical bid win/loss tracking
- Industry-wise tender category distribution
- Average time from upload to submission tracking

### 7. 🔔 Real-Time Tagging & Notification Badges (Completed ✅)
- Multi-user `@mention` tracking synced with Supabase Realtime client.
- Glowing section counter badges, pulsing dot indicators on clause-level drawers, and automatic read/dismiss counters.

### 8. 📋 Kanban Bid Lifecycle Board (Completed ✅)
- Multi-user Kanban Board tracking tenders across stages from Discovered to Submitted.
- Drag-and-drop workflow status updates, synced in real-time.

### 9. 🎙️ Executive Audio Briefings / Podcast Mode (Completed ✅)
- Generates simulated two-host podcast conversations summarizing tender details, deadlines, EMD, and risks.
- Integrated HTML5 MP3 audio player widget with full transport controls and offline download support.

---

## License

MIT License — see `LICENSE` file for details.

---

*Built with ❤️ using Google Gemini, Supabase, FastAPI, and React.*
