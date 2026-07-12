import os
from dotenv import load_dotenv
load_dotenv()

from crawler import simulate_government_portal_crawl
from matcher import match_tenders_to_profile

def test_crawler_and_matcher():
    print("Testing Portal Crawler...")
    keywords = ["transformer", "solar"]
    crawled_tenders = simulate_government_portal_crawl(keywords)
    
    assert len(crawled_tenders) > 0, "Crawler returned empty listings."
    print(f"Crawler successfully retrieved {len(crawled_tenders)} items.")
    for item in crawled_tenders:
        assert "title" in item
        assert "portal_name" in item
        assert "tender_value" in item
        assert "deadline" in item
        assert "description" in item
        print(f" - [{item['portal_name']}] {item['title']} ({item['tender_value']})")

    print("\nTesting Compatibility Matcher...")
    company_profile = (
        "We are a power electrical manufacturer with 10 years of experience supply "
        "and commissioning 220kV power transformers (50MVA, 100MVA capacities) to national utilities. "
        "We hold ISO 9001 and ISO 14001 certifications. We have built solar rooftop installations up to 100 kW."
    )
    
    matched_results = match_tenders_to_profile(crawled_tenders, company_profile)
    assert len(matched_results) == len(crawled_tenders), "Matcher count mismatch."
    
    print("\nMatched Results & AI Suitability Scores:")
    for matched in matched_results:
        assert "compatibility_score" in matched
        assert "compatibility_reason" in matched
        print(f" - Score: {matched['compatibility_score']}%")
        print(f"   Reason: {matched['compatibility_reason']}")
        print(f"   Description: {matched['description'][:100]}...\n")
        
    print("All Lead Generation pipeline tests PASSED!")

if __name__ == "__main__":
    test_crawler_and_matcher()
