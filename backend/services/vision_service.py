import os
import json
import base64
import httpx
from fastapi import HTTPException
from dotenv import load_dotenv

SYSTEM_PROMPT = """Extract the bill details into JSON. Follow this schema exactly:
{
  "restaurant_name": "string or null",
  "items": [
    {"name": "string", "quantity": number, "unit_price": number, "total_price": number, "confidence": "high|medium|low"}
  ],
  "subtotal": number_or_null,
  "discount": number_or_null,
  "taxes": [{"name": "string", "rate": number_or_null, "amount": number, "confidence": "high|medium|low|absent"}],
  "service_charge": number_or_null,
  "total": number_or_null
}
All monetary values must be exact decimal values as seen on the bill. Return ONLY valid JSON, no markdown formatting.
"""

def to_paise(value) -> int:
    if value is None:
        return None
    try:
        return round(float(value) * 100)
    except (ValueError, TypeError):
        return None

def _process_response_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text.strip())

def _convert_to_paise_dict(data: dict) -> dict:
    if "items" in data:
        for item in data["items"]:
            item["unit_price"] = to_paise(item.get("unit_price"))
            item["total_price"] = to_paise(item.get("total_price"))
    if "taxes" in data:
        for tax in data["taxes"]:
            tax["amount"] = to_paise(tax.get("amount"))
            
    data["subtotal"] = to_paise(data.get("subtotal"))
    data["discount"] = to_paise(data.get("discount"))
    data["service_charge"] = to_paise(data.get("service_charge"))
    data["total"] = to_paise(data.get("total"))
    return data

def _get_demo_ocr_bill() -> dict:
    """Fallback OCR draft when VISION_API_KEY is not configured yet."""
    return {
        "restaurant_name": "Grand Cafe & Pizzeria",
        "items": [
            {"name": "Margherita Pizza", "quantity": 1, "unit_price": 45000, "total_price": 45000, "confidence": "high"},
            {"name": "Pasta Carbonara", "quantity": 1, "unit_price": 38000, "total_price": 38000, "confidence": "high"},
            {"name": "Garlic Bread", "quantity": 1, "unit_price": 16000, "total_price": 16000, "confidence": "medium"},
            {"name": "Fresh Lime Soda", "quantity": 2, "unit_price": 9000, "total_price": 18000, "confidence": "high"},
        ],
        "subtotal": 117000,
        "discount": 10000,
        "taxes": [
            {"name": "CGST 2.5%", "rate": 0.025, "amount": 2675, "confidence": "high"},
            {"name": "SGST 2.5%", "rate": 0.025, "amount": 2675, "confidence": "high"}
        ],
        "service_charge": 5850,
        "total": 118200,
        "warnings": [
            "Extracted via demo OCR engine (Configure VISION_API_KEY in .env for live AI extraction)."
        ]
    }

async def call_openai(image_b64: str, content_type: str, api_key: str, model: str, retry: bool = False) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    prompt = SYSTEM_PROMPT
    if retry:
        prompt += "\n\nThe previous attempt produced invalid JSON. Ensure the output is strictly valid JSON matching the schema."
        
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{content_type};base64,{image_b64}"
                        }
                    }
                ]
            }
        ],
        "response_format": {"type": "json_object"},
        "max_tokens": 1024
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

async def call_anthropic(image_b64: str, content_type: str, api_key: str, model: str, retry: bool = False) -> str:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    prompt = SYSTEM_PROMPT
    if retry:
        prompt += "\n\nThe previous attempt produced invalid JSON. Ensure the output is strictly valid JSON matching the schema."
        
    payload = {
        "model": model,
        "max_tokens": 1024,
        "system": prompt,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": content_type,
                            "data": image_b64
                        }
                    },
                    {
                        "type": "text",
                        "text": "Extract bill details as JSON."
                    }
                ]
            }
        ]
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        return data["content"][0]["text"]

async def extract_bill(image_bytes: bytes, content_type: str = "image/jpeg") -> dict:
    load_dotenv(override=True)
    provider = os.getenv("VISION_PROVIDER", "openai").lower()
    api_key = os.getenv("VISION_API_KEY", "").strip()
    
    # If API key is not configured or is a placeholder, use graceful demo OCR extraction
    if not api_key or api_key == "your-api-key-here":
        return _get_demo_ocr_bill()

    default_model = "gpt-4o" if provider == "openai" else "claude-3-5-sonnet-20240620"
    model = os.getenv("VISION_MODEL", default_model)
    
    image_b64 = base64.b64encode(image_bytes).decode('utf-8')
    provider_fn = call_openai if provider == "openai" else call_anthropic
    
    try:
        raw_response = await provider_fn(image_b64, content_type, api_key, model, retry=False)
        parsed = _process_response_json(raw_response)
        return _convert_to_paise_dict(parsed)
    except Exception as e:
        try:
            raw_response = await provider_fn(image_b64, content_type, api_key, model, retry=True)
            parsed = _process_response_json(raw_response)
            return _convert_to_paise_dict(parsed)
        except Exception as retry_e:
            raise HTTPException(status_code=422, detail="Couldn't read that bill — try a clearer photo, or enter it by hand")
