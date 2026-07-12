import requests
from typing import List, Dict

def send_slack_alert(webhook_url: str, organization_name: str, matches: List[Dict]) -> bool:
    """
    Sends a rich formatted Slack alert message with details of crawled tender matches.
    """
    if not webhook_url or not webhook_url.strip():
        return False
        
    try:
        # We only want to notify matches with compatibility score >= 70% to avoid notification spam
        high_matches = [m for m in matches if m.get("compatibility_score", 0) >= 70]
        if not high_matches:
            return False
            
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📢 New Automated RFP Matches Found!",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"We scanned government portals today and found *{len(high_matches)}* new active opportunities matching the profile criteria for *{organization_name}*."
                }
            },
            {"type": "divider"}
        ]
        
        # Add up to 3 highest scoring matches to avoid massive slack messages
        sorted_matches = sorted(high_matches, key=lambda x: x.get("compatibility_score", 0), reverse=True)[:3]
        
        for idx, match in enumerate(sorted_matches):
            title = match.get("title", "Government Tender")
            portal = match.get("portal_name", "Procurement Portal")
            value = match.get("tender_value", "N/A")
            score = match.get("compatibility_score", 70)
            reason = match.get("compatibility_reason", "Aligned with keywords.")
            
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{idx+1}. {title}*\n"
                            f"• *Portal:* {portal}\n"
                            f"• *Estimated Value:* {value}\n"
                            f"• *TenderIQ Compatibility:* `{score}% Match`\n"
                            f"• *Rationale:* _{reason}_"
                }
            })
            
        blocks.append({"type": "divider"})
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": "💡 _Log in to the *TenderIQ Portal* to review, perform full audit gap analysis, or auto-generate draft bid proposals for these opportunities._"
                }
            ]
        })
        
        payload = {"blocks": blocks}
        res = requests.post(webhook_url, json=payload, timeout=10)
        return res.status_code == 200
    except Exception as e:
        print(f"Failed to dispatch Slack webhook alert: {e}")
        return False
