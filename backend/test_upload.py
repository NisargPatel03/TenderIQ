import requests

url = "http://127.0.0.1:8000/api/upload"
data = {
    "tender_id": "c1f7b0f6-9f79-4a94-87cf-9e6b36ff5e81", # dummy UUID
    "raw_text": "This is a test tender document content."
}
headers = {
    "Authorization": "Bearer dummy_token"
}

try:
    print("Sending POST request to backend...")
    res = requests.post(url, data=data, headers=headers)
    print("Status Code:", res.status_code)
    print("Response JSON:", res.json())
except Exception as e:
    print("Connection failed:", e)
