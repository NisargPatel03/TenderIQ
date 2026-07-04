import os
import json
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
            model_name="gemini-1.5-flash",
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

    def ask_tender_question(self, document_text: str, question: str, history: list[dict]) -> str:
        """Answers a user's question about the tender utilizing the document context and past chat history."""
        # Truncate document text to stay within bounds
        truncated_text = document_text[:1000000]
        
        # Build history context
        history_context = ""
        for chat in history:
            q = chat.get("question", "")
            a = chat.get("answer", "")
            history_context += f"User: {q}\nAI: {a}\n\n"
            
        prompt = f"""
You are a professional bidding consultant answering a user's question about a specific tender.
Below is the full text of the tender:
---
{truncated_text}
---

Here is the conversation history so far:
{history_context}

User's Question: {question}

Please answer the user's question directly, clearly, and professional based on the tender text. 
- Quote or reference sections where possible.
- If the answer cannot be found in the text, clearly state: "I couldn't find this information in the tender document."
- Keep formatting clean using markdown bullet points or bold text if helpful.
"""
        
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
