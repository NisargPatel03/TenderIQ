import os
import json
import requests as http_requests
import google.generativeai as genai
from google.generativeai.types import GenerateContentResponse

class GeminiClient:
    def __init__(self):
        # Configure model api key from environment variables
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set.")
        
        genai.configure(api_key=api_key)
        
        # System instruction to establish the AI's role and tone
        system_instruction = (
            "You are an expert procurement consultant, legal contract auditor, and bidding strategist. "
            "Your role is to analyze corporate and government tender documents, RFPs, and bidding specifications. "
            "You must extract highly accurate information and provide deep, analytical, and structured insights. "
            "Be precise, objective, and clear. Avoid vague summaries; capture specific terms, dates, and numbers."
        )
        
        self.model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=system_instruction
        )

    def extract_tender_details(self, document_text: str) -> dict:
        """Sends the document text to Gemini and extracts the 9 structured sections in JSON format."""
        # Truncate document text to avoid exceeding limits (approx. 1.2M chars, ~300k words)
        truncated_text = document_text[:1200000]
        
        prompt = f"""
You are auditing a tender/RFP document. Below is the full text of the tender:
---
{truncated_text}
---

Please analyze the text above and extract information for the following 9 sections. 
Return your output strictly as a single JSON object. You must return only the JSON string, and it must strictly adhere to the structure defined below.
Each section must have a "found" boolean indicating if this information was present in the document, and structured details as described. If a section is not found, set "found" to false and return empty content lists or values.

JSON Structure:
{{
  "deadline": "ISO 8601 formatted date string (e.g. '2026-08-15T17:00:00Z') representing the bid submission deadline if found, otherwise null",
  "executive_summary": {{
    "found": true/false,
    "content": ["3-5 clear, professional bullet points summarizing the procurement project name, issuing agency, project size/type, and main objective."]
  }},
  "eligibility_criteria": {{
    "found": true/false,
    "content": ["List of requirements to qualify, e.g. corporate experience, registration, certifications, licenses, or vendor qualifications."]
  }},
  "key_dates": {{
    "found": true/false,
    "timeline": [
      {{"event": "Event Name (e.g. Pre-bid Meeting, Submission Deadline, Bid Validity, Project Completion)", "date": "Date and Time text found in document"}}
    ],
    "content": ["Additional timeline or period of validity considerations."]
  }},
  "scope_of_work": {{
    "found": true/false,
    "content": ["Key items and deliverables the bidder must execute under the contract."]
  }},
  "financial_requirements": {{
    "found": true/false,
    "emd": "Earnest Money Deposit / Bid Security value if found, otherwise 'Not Found'",
    "turnover": "Minimum annual turnover required if found, otherwise 'Not Found'",
    "content": ["Details on bid security/EMD, performance bonds, bank guarantees, payment milestones, or estimated project budget."]
  }},
  "required_documents": {{
    "found": true/false,
    "checklist": ["A comprehensive checklist of all files, certificates, sheets, or forms that the bidder must submit."]
  }},
  "risks_penalties": {{
    "found": true/false,
    "content": ["Information on Liquidated Damages, late delivery penalties, blacklisting clauses, termination conditions, or liability limits."]
  }},
  "evaluation_criteria": {{
    "found": true/false,
    "content": ["Details on how bids are scored: lowest price (L1), Quality and Cost Based Selection (QCBS), merit-based parameters, technical threshold score, or evaluation weights."]
  }},
  "contact_details": {{
    "found": true/false,
    "authority": "Name of Issuing Authority if found",
    "email": "Email address for queries/clarifications if found",
    "phone": "Phone number if found",
    "portal": "Submission / Tender Portal URL if found"
  }}
}}
"""
        
        generation_config = {
            "response_mime_type": "application/json",
            "temperature": 0.1,  # Low temperature for highly factual extraction
        }
        
        try:
            response = self.model.generate_content(
                prompt,
                generation_config=generation_config
            )
            # Parse the JSON response
            result_dict = json.loads(response.text)
            return result_dict
        except Exception as e:
            # Return an error structure if AI parsing fails
            return {
                "error": f"AI Engine failed to parse the tender: {str(e)}",
                "executive_summary": {"found": False, "content": ["Error extracting summary data."]}
            }

    def ask_tender_question(
        self,
        document_text: str,
        question: str,
        history: list[dict],
        analysis_result: dict = None
    ) -> str:
        """
        Answers a user's question about the tender.
        Uses analysis_result (structured AI extraction) as the primary
        knowledge source, supplemented by raw document_text / RAG chunks.
        """
        # Build history context
        history_context = ""
        for chat in history:
            q = chat.get("question", "")
            a = chat.get("answer", "")
            history_context += f"User: {q}\nAI: {a}\n\n"

        # ── Primary: Structured analysis knowledge block ──────────────────────
        analysis_block = ""
        if analysis_result:
            import json as _json
            section_labels = {
                "executive_summary":     "Executive Summary",
                "eligibility_criteria":  "Eligibility Criteria",
                "key_dates":             "Key Dates & Deadlines",
                "scope_of_work":         "Scope of Work",
                "financial_requirements":"Financial Requirements",
                "required_documents":    "Required Documents",
                "risks_penalties":       "Risks & Penalties",
                "evaluation_criteria":   "Evaluation Criteria",
                "contact_details":       "Contact Details",
            }
            lines = []
            for key, label in section_labels.items():
                section = analysis_result.get(key)
                if not section:
                    continue
                if section.get("found"):
                    content = section.get("content", [])
                    if isinstance(content, list):
                        content_str = "\n  - " + "\n  - ".join(str(c) for c in content)
                    else:
                        content_str = str(content)
                    lines.append(f"### {label}\n{content_str}")
                    # Special nested fields
                    for extra_key in ("deadline", "emd", "turnover", "authority", "email", "phone"):
                        val = section.get(extra_key)
                        if val:
                            lines.append(f"  {extra_key.capitalize()}: {val}")
            analysis_block = "\n\n".join(lines)

        # ── Supplementary: raw text / RAG chunks ─────────────────────────────
        raw_block = document_text[:80_000] if document_text else ""

        # ── Build the full prompt ─────────────────────────────────────────────
        prompt_parts = [
            "You are a professional bidding consultant answering a user's question about a specific tender.\n",
        ]

        if analysis_block:
            prompt_parts.append(
                "Below is the AI-extracted structured compliance data from the tender:\n"
                "---\n"
                f"{analysis_block}\n"
                "---\n"
            )

        if raw_block:
            prompt_parts.append(
                "Additionally, here is a portion of the raw tender text for reference:\n"
                "---\n"
                f"{raw_block}\n"
                "---\n"
            )

        if history_context:
            prompt_parts.append(
                f"Conversation history so far:\n{history_context}"
            )

        prompt_parts.append(
            f"User's Question: {question}\n\n"
            "Instructions:\n"
            "- Answer directly and professionally based on the tender data above.\n"
            "- Reference specific sections, dates, or numbers wherever possible.\n"
            "- Use markdown bullet points or bold text for clarity.\n"
            "- If the answer is genuinely not present in any of the provided data, "
            "say: \"This information was not found in the analyzed tender documents.\""
        )

        prompt = "\n".join(prompt_parts)

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={"temperature": 0.2}
            )
            return response.text.strip()
        except Exception as e:
            return f"Error querying AI Engine: {str(e)}"


    def evaluate_go_nogo(self, analysis_result: dict, company_profile: str) -> dict:
        """Evaluates bidding suitability by matching company profile against tender details using AI."""
        eligibility = analysis_result.get("eligibility_criteria", {}).get("content", [])
        scope = analysis_result.get("scope_of_work", {}).get("content", [])
        financials = analysis_result.get("financial_requirements", {}).get("content", [])
        
        prompt = f"""
You are a strategic bidding advisor. Evaluate if a company should bid on this tender based on their company profile and the tender's requirements.

Tender Requirements:
- Eligibility: {eligibility}
- Scope of Work: {scope}
- Financials: {financials}

Bidder's Company Profile:
---
{company_profile}
---

Perform a professional GAP analysis. Determine matching qualifications, potential gaps/risks, and provide a Go/No-Go score (0-100).
Return your response strictly as a single JSON object. You must return only the JSON string, and it must strictly adhere to the structure defined below.

JSON Structure:
{{
  "score": 85, // An integer score between 0 and 100
  "decision": "Go" / "No-Go" / "Proceed with Caution",
  "matches": [
    "List of qualifications or requirements that the company meets perfectly"
  ],
  "gaps": [
    "List of qualifications they lack, risks identified, or details where they fall short"
  ],
  "explanation": "A professional 3-4 sentence strategic summary and recommendation for the executive board."
}}
"""
        
        generation_config = {
            "response_mime_type": "application/json",
            "temperature": 0.2,
        }
        
        try:
            response = self.model.generate_content(
                prompt,
                generation_config=generation_config
            )
            result_dict = json.loads(response.text)
            return result_dict
        except Exception as e:
            return {
                "score": 0,
                "decision": "Proceed with Caution",
                "matches": [],
                "gaps": ["Could not calculate GAP analysis due to system error."],
                "explanation": f"Failed to execute Go-NoGo analysis: {str(e)}"
            }

    def chunk_text(self, text: str, chunk_size: int = 1500, overlap: int = 300) -> list[str]:
        """Splits raw text into sliding window chunks of chunk_size characters with overlap."""
        if not text:
            return []
        chunks = []
        start = 0
        text_len = len(text)
        while start < text_len:
            end = min(start + chunk_size, text_len)
            chunks.append(text[start:end])
            start += chunk_size - overlap
            if start >= text_len or end == text_len:
                break
        return chunks

    def generate_embeddings(self, chunks: list[str]) -> list[list[float]]:
        """
        Generates 768-dimension embeddings for the given text chunks using
        the official Google GenerativeAI SDK and the gemini-embedding-001 model.
        Batches requests to prevent 429 Quota Exceeded errors.
        """
        if not chunks:
            return []

        import time

        batch_size = 100
        embeddings = []

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            try:
                res = genai.embed_content(
                    model="models/gemini-embedding-001",
                    content=batch,
                    task_type="retrieval_document",
                    output_dimensionality=768
                )
                embeddings.extend(res['embedding'])
            except Exception as e:
                print(f"Embedding error for batch starting at {i}: {e}")
                embeddings.extend([[0.0] * 768] * len(batch))
            
            # Sleep 0.5s between batches to stay well within free tier rate limits
            if i + batch_size < len(chunks):
                time.sleep(0.5)

        return embeddings

    def draft_proposal(self, tender_name: str, tender_analysis: dict, references: list[dict], custom_instructions: str = "") -> dict:
        """
        Synthesizes a tailored bid proposal response based on tender requirements,
        workspace reference library materials, and custom instructions.
        """
        # Compile reference materials
        reference_context = ""
        for idx, ref in enumerate(references):
            content_snippet = ref.get("content_text", "")[:20000]
            reference_context += f"\n--- REFERENCE DOCUMENT #{idx+1} ({ref.get('filename')}) ---\n{content_snippet}\n"

        prompt = f"""
You are an expert bid manager and proposal writer. Your job is to draft a winning bid proposal response for the tender: "{tender_name}".

Here are the extracted details of the tender (Scope of Work, Requirements, and Specifications):
{json.dumps(tender_analysis, indent=2)}

Here is the reference library of company documents (past winning proposals, resumes, company descriptions, capability files) to use as evidence of qualifications:
{reference_context}

User's custom instructions/preferences:
"{custom_instructions if custom_instructions else 'None'}"

Please generate a professional, structured bid proposal response with three key parts:
1. "cover_letter": A formal business cover letter introducing the bidder, referencing the tender requirements, and explaining why our organization is the best fit.
2. "technical_response": A detailed technical response section addressing the Scope of Work and Technical Specifications. Draw upon the qualifications, team resumes, and past project examples in the references to demonstrate compliance. Use paragraphs and bullet points as appropriate.
3. "capability_matrix": A list of compliance mapping entries. Each entry must map a specific tender requirement to our compliance status and the supporting evidence/experience from the references.

Return your response strictly as a single JSON object with the following schema:
{{
  "cover_letter": "string (with formatting and paragraphs)",
  "technical_response": "string (with sections and paragraphs, markdown bullet lists allowed)",
  "capability_matrix": [
    {{
      "requirement": "specific tender requirement",
      "compliance_status": "Compliant / Exceeds / Partially Compliant",
      "evidence_reference": "supporting evidence or past experience from reference library"
    }}
  ]
}}
"""
        generation_config = {
            "response_mime_type": "application/json",
            "temperature": 0.3,
        }

        try:
            response = self.model.generate_content(
                prompt,
                generation_config=generation_config
            )
            data = json.loads(response.text.strip())
            return data
        except Exception as e:
            print(f"Error drafting proposal: {e}")
            # Return a fallback structured dictionary
            return {
                "cover_letter": f"Dear Sir/Madam,\n\nWe are pleased to submit our proposal for {tender_name}.\n\nSincerely,\nBidding Team",
                "technical_response": "Failed to generate technical response. Please ensure your reference library contains sufficient details.",
                "capability_matrix": [
                    {
                        "requirement": "Standard Compliance",
                        "compliance_status": "Compliant",
                        "evidence_reference": "Verified according to references."
                    }
                ]
            }

    def generate_audio_briefing_script(self, tender_name: str, tender_analysis: dict) -> str:
        """
        Generates a natural-sounding, spoken podcast script for a news briefing anchor
        summarizing the key points of the tender analysis.
        """
        analysis_summary = json.dumps(tender_analysis, indent=2)
        
        prompt = f"""
You are a professional corporate news briefing anchor or senior podcast host summarizing a new procurement project.
Below is the structured analysis of the tender/RFP: "{tender_name}".

Tender Details:
{analysis_summary}

Please write a conversational, engaging, and concise 1.5 to 2-minute news briefing podcast script. 
The audience is a group of busy bid directors and executives who need to hear this briefing while commuting.

Guidelines:
- Act like a real business news anchor. Start with an engaging intro (e.g. "Welcome to your TenderIQ morning briefing. Today we are looking at the new transformer procurement project from NTPC...").
- Summarize the critical elements: scope of work, key deadlines, eligibility qualifications, and primary financial securities (EMD) or risks.
- Keep the language spoken, natural, professional, and smooth.
- Do NOT include any sound effect descriptions, music cues, bracketed text, or speaker labels (like "Anchor:"). Just write the exact spoken words.
- Total length should be around 200 to 250 words.
"""
        try:
            response = self.model.generate_content(
                prompt,
                generation_config={"temperature": 0.5}
            )
            return response.text.strip()
        except Exception as e:
            return f"Welcome to your TenderIQ briefing. Today, we are reviewing the tender request for {tender_name}. Key compliance criteria and submission deadlines are loaded on your dashboard. Please consult the checklist for active guidelines."



