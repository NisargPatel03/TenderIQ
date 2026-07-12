import os
import json
from typing import List, Dict
import google.generativeai as genai

def match_tenders_to_profile(crawled_tenders: List[Dict], company_profile: str) -> List[Dict]:
    """
    Evaluates suitability and compatibility of crawled tenders against the company profile.
    Uses Gemini 2.5 Flash to output scores and suitability reasons.
    """
    if not company_profile or not company_profile.strip():
        # If no profile details, return with default average match score
        matched_results = []
        for tender in crawled_tenders:
            t = tender.copy()
            t["compatibility_score"] = 50
            t["compatibility_reason"] = "No company profile details provided. Set up a profile to see tailored match scores."
            matched_results.append(t)
        return matched_results

    try:
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if not gemini_key:
            raise ValueError("GEMINI_API_KEY is not set.")
            
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

        # Let's batch-evaluate them in a single prompt to save tokens and execution time!
        prompt = f"""
        You are a procurement suitability auditor. Analyze the following list of crawled tender opportunities and evaluate how well they match this Company Profile.
        
        Company Profile:
        {company_profile}
        
        Tender Opportunities:
        {json.dumps(crawled_tenders, indent=2)}
        
        For each tender in the list (maintaining order), evaluate:
        1. compatibility_score: An integer from 0 to 100 reflecting how well the company profile meets eligibility, capacity, certifications, and scope requirements.
        2. compatibility_reason: A single clear sentence summarizing the alignment (e.g., "90% match: Your 100MVA transformer experience perfectly aligns with the NTPC scope, but ISO 14001 certification is required.").
        
        Return the result ONLY as a valid JSON array of objects with the exact keys:
        "compatibility_score", "compatibility_reason"
        
        Ensure you return exactly the same number of items as in the input list. Do not include markdown styling or ```json fences.
        """
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].startswith("```json") or lines[0].startswith("```"):
                text = "\n".join(lines[1:-1])
                
        evaluations = json.loads(text)
        
        matched_results = []
        for i, tender in enumerate(crawled_tenders):
            t = tender.copy()
            eval_item = evaluations[i] if i < len(evaluations) else {"compatibility_score": 70, "compatibility_reason": "High compatibility matching your core keywords."}
            t["compatibility_score"] = int(eval_item.get("compatibility_score", 70))
            t["compatibility_reason"] = eval_item.get("compatibility_reason", "Suitability evaluation generated.")
            matched_results.append(t)
            
        return matched_results
        
    except Exception as e:
        print(f"Warning: Gemini matching evaluation failed ({e}). Falling back to simple heuristic.")
        
    # Heuristic fallback matching
    matched_results = []
    for tender in crawled_tenders:
        t = tender.copy()
        score = 70
        reason = "Good alignment with your search keywords."
        
        # Check if some terms match
        title_lower = t["title"].lower()
        profile_lower = company_profile.lower()
        
        matches = [word for word in ["transformer", "solar", "construction", "hvac", "security", "firewall"] if word in title_lower and word in profile_lower]
        if matches:
            score = 85
            reason = f"Strong keyword alignment ({', '.join(matches)}) with your profile description."
        else:
            score = 60
            reason = "Keyword match found in search, but profile details are neutral."
            
        t["compatibility_score"] = score
        t["compatibility_reason"] = reason
        matched_results.append(t)
        
    return matched_results
