import os
import random
import json
from typing import List, Dict
import google.generativeai as genai

def simulate_government_portal_crawl(keywords: List[str]) -> List[Dict]:
    """
    Simulates crawling government procurement portals (e.g. CPPP, GeM, GovTenders).
    Generates realistic tender listings based on provided keywords.
    """
    # Default high-quality fallback items
    fallbacks = [
        {
            "title": "Supply and Installation of 100MVA Power Transformers for NTPC Ramagundam",
            "portal_name": "Central Public Procurement Portal (CPPP)",
            "tender_value": "₹12.5 Crores ($1.5M USD)",
            "deadline": "2026-09-15T11:00:00Z",
            "description": "Design, engineering, manufacture, testing at shop, supply, transportation to site, supervision of erection, testing and commissioning of 100MVA, 220/132kV Power Transformers for NTPC Ramagundam project site. Technical compliance mandates 5 years of manufacturing experience in similar ratings."
        },
        {
            "title": "Grid Connected Rooftop Solar Power Plant Installation (500 kWp)",
            "portal_name": "Government e-Marketplace (GeM)",
            "tender_value": "₹2.8 Crores ($340K USD)",
            "deadline": "2026-08-30T15:00:00Z",
            "description": "Design, supply, installation, testing and commissioning of 500 kWp grid-connected rooftop solar PV power plants at various government office buildings in Gandhinagar, Gujarat. Scope includes 5 years comprehensive operation & maintenance."
        },
        {
            "title": "Construction of High-Tech IT Park building complex in GIFT City",
            "portal_name": "Gujarat Government Tenders Portal",
            "tender_value": "₹85.0 Crores ($10.2M USD)",
            "deadline": "2026-10-10T17:00:00Z",
            "description": "Selection of contractor for engineering, procurement, and construction (EPC) of a G+8 high-tech commercial building structure inside GIFT City, Gandhinagar. EMD: ₹85 Lakhs. Class A registration certificate required."
        },
        {
            "title": "Supply of Enterprise Grade Cyber Security Firewalls and Threat Management Systems",
            "portal_name": "Central Public Procurement Portal (CPPP)",
            "tender_value": "₹1.5 Crores ($180K USD)",
            "deadline": "2026-08-20T14:30:00Z",
            "description": "Procurement of next-generation enterprise firewalls, unified threat management consoles, and secure endpoint clients for National Informatics Centre data centers. Deployment must be completed within 90 days from contract award."
        },
        {
            "title": "Annual Maintenance Contract for Commercial HVAC Systems",
            "portal_name": "Government e-Marketplace (GeM)",
            "tender_value": "₹45 Lakhs ($54K USD)",
            "deadline": "2026-08-15T12:00:00Z",
            "description": "Comprehensive maintenance contract for centralized HVAC chilling systems, air handling units, and water cooling pumps at Supreme Court buildings. Only contractors with ISO 14001 certification may bid."
        }
    ]
    
    # If no keywords are provided, return a random subset of fallback tenders
    if not keywords or all(not kw.strip() for kw in keywords):
        return random.sample(fallbacks, min(3, len(fallbacks)))

    # Clean keywords
    cleaned_kws = [kw.strip().lower() for kw in keywords if kw.strip()]
    
    # Try using Gemini to generate highly tailored mock tenders matching these keywords
    try:
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if not gemini_key:
            raise ValueError("GEMINI_API_KEY not configured")
        
        # Configure model
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        prompt = f"""
        You are a web scraper simulator for government procurement portals.
        Generate a list of 4 realistic active government tender listings matching these search keywords: {", ".join(cleaned_kws)}.
        
        For each tender listing, provide:
        1. Title: Professional procurement title (e.g. "Procurement of...", "EPC Contract for...").
        2. Portal Name: Pick one of "Central Public Procurement Portal (CPPP)", "Government e-Marketplace (GeM)", "National Tenders Portal", or regional state portals.
        3. Tender Value: A realistic project estimate (e.g., in Lakhs/Crores INR or USD).
        4. Deadline: A ISO timestamp set in the future (between 30 to 90 days from today).
        5. Description: A paragraph describing the project scope, technical ratings, required certifications (e.g. ISO 9001), and eligibility criteria. Make sure it explicitly uses one or more of the keywords.
        
        Return the result ONLY as a valid JSON array of objects with the exact keys:
        "title", "portal_name", "tender_value", "deadline", "description"
        
        Do not output any markdown formatting other than raw JSON. Do not include ```json blocks.
        """
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        # Clean up any potential markdown fences
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].startswith("```json") or lines[0].startswith("```"):
                text = "\n".join(lines[1:-1])
        
        tenders = json.loads(text)
        if isinstance(tenders, list) and len(tenders) > 0:
            return tenders
    except Exception as e:
        print(f"Warning: Crawler Gemini simulation failed ({e}), falling back to predefined listings.")
        
    # Standard keyword filter fallback logic
    matched = []
    for f in fallbacks:
        text_to_check = (f["title"] + " " + f["description"]).lower()
        if any(kw in text_to_check for kw in cleaned_kws):
            matched.append(f)
            
    if not matched:
        # If no keywords matched our small database of fallbacks, return a random sample of 3 fallback items
        return random.sample(fallbacks, min(3, len(fallbacks)))
        
    return matched
