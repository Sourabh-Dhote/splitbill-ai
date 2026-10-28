import os
import json
import base64
import re
import httpx
from fastapi import HTTPException
from dotenv import load_dotenv

SYSTEM_PROMPT = """You are extracting structured information from a photograph of a restaurant bill.
Read only information visible on the bill. Do not invent missing values.
Return valid JSON matching the schema below — raw JSON only, no markdown fences, no commentary:
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
All monetary values must be numbers in rupees (e.g. 250.00). Do not perform bill splitting.
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
    if "items" in data and isinstance(data["items"], list):
        for item in data["items"]:
            qty = int(item.get("quantity") or 1)
            item["quantity"] = max(1, qty)
            u_price = to_paise(item.get("unit_price"))
            t_price = to_paise(item.get("total_price"))
            if t_price is None and u_price is not None:
                t_price = u_price * item["quantity"]
            elif u_price is None and t_price is not None:
                u_price = round(t_price / item["quantity"])
            item["unit_price"] = u_price or 0
            item["total_price"] = t_price or 0
            if item.get("confidence") not in ["high", "medium", "low"]:
                item["confidence"] = "high"

    if "taxes" in data and isinstance(data["taxes"], list):
        for tax in data["taxes"]:
            tax["amount"] = to_paise(tax.get("amount")) or 0
            if tax.get("confidence") not in ["high", "medium", "low", "absent"]:
                tax["confidence"] = "high"

    data["subtotal"] = to_paise(data.get("subtotal"))
    data["discount"] = to_paise(data.get("discount"))
    data["service_charge"] = to_paise(data.get("service_charge"))
    data["total"] = to_paise(data.get("total"))
    return data

def extract_with_local_ocr(image_bytes: bytes) -> dict:
    """Extracts text lines and parses restaurant bill using RapidOCR on CPU."""
    try:
        from rapidocr_onnxruntime import RapidOCR
        ocr = RapidOCR()
        result, _ = ocr(image_bytes)
    except Exception as e:
        print(f"RapidOCR execution failed: {e}")
        result = None

    if not result:
        return {
            "restaurant_name": "Restaurant",
            "items": [
                {"name": "Food Item 1", "quantity": 1, "unit_price": 20000, "total_price": 20000, "confidence": "low"}
            ],
            "subtotal": 20000,
            "discount": 0,
            "taxes": [],
            "service_charge": 0,
            "total": 20000,
            "warnings": [
                "Could not automatically detect text from the photo. Please review and edit the items below."
            ]
        }

    # Format result: list of (text, confidence)
    ocr_lines = []
    for item in result:
        # item is [box_coordinates, text, confidence_score]
        if len(item) >= 3 and item[1].strip():
            ocr_lines.append((item[1].strip(), float(item[2])))

    if not ocr_lines:
        return {
            "restaurant_name": "Restaurant",
            "items": [],
            "subtotal": 0,
            "discount": 0,
            "taxes": [],
            "service_charge": 0,
            "total": 0,
            "warnings": ["No text detected in the image."]
        }

    restaurant_name = ocr_lines[0][0]
    items = []
    subtotal = None
    discount = None
    taxes = []
    service_charge = None
    total = None
    warnings = ["Extracted from your photo using built-in OCR. Please verify items and prices."]

    price_pattern = re.compile(r'(\d+[\.,]\d{2}|\b\d{2,6}\b)')

    for text, conf in ocr_lines[1:]:
        lower = text.lower()
        conf_str = "high" if conf >= 0.85 else ("medium" if conf >= 0.65 else "low")
        matches = price_pattern.findall(text)

        # Check total / subtotal / tax lines
        if "subtotal" in lower or "sub total" in lower:
            if matches:
                subtotal = to_paise(matches[-1].replace(',', '.'))
        elif "discount" in lower or "disc" in lower or "promo" in lower:
            if matches:
                discount = to_paise(matches[-1].replace(',', '.'))
        elif any(t in lower for t in ["cgst", "sgst", "gst", "vat", "tax"]):
            if matches:
                tax_amt = to_paise(matches[-1].replace(',', '.'))
                tax_name = text.split()[0] if text.split() else "GST"
                taxes.append({
                    "name": tax_name,
                    "amount": tax_amt,
                    "confidence": conf_str
                })
        elif "service" in lower and ("charge" in lower or "chg" in lower):
            if matches:
                service_charge = to_paise(matches[-1].replace(',', '.'))
        elif any(w in lower for w in ["total", "grand total", "net amount", "amount due", "final"]):
            if matches:
                total = to_paise(matches[-1].replace(',', '.'))
        else:
            # Line item candidate
            if matches:
                last_num = matches[-1]
                price = to_paise(last_num.replace(',', '.'))
                # Text before the price
                name_part = text[:text.rfind(last_num)].strip(" -:.")
                qty = 1
                qty_match = re.match(r'^(\d+)\s*[xX*]?\s+(.*)', name_part)
                if qty_match:
                    qty = max(1, int(qty_match.group(1)))
                    name_part = qty_match.group(2).strip()

                unit_price = round(price / qty) if qty > 0 else price
                if name_part and len(name_part) > 1 and price > 0:
                    items.append({
                        "name": name_part,
                        "quantity": qty,
                        "unit_price": unit_price,
                        "total_price": price,
                        "confidence": conf_str
                    })

    # If subtotal not printed, calculate from items
    calc_subtotal = sum(i["total_price"] for i in items) if items else 0
    if subtotal is None:
        subtotal = calc_subtotal

    # If total not printed, calculate
    if total is None:
        total = subtotal - (discount or 0) + sum(t["amount"] for t in taxes) + (service_charge or 0)

    return {
        "restaurant_name": restaurant_name,
        "items": items,
        "subtotal": subtotal,
        "discount": discount,
        "taxes": taxes,
        "service_charge": service_charge,
        "total": total,
        "warnings": warnings
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
        "max_tokens": 1500
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
        "max_tokens": 1500,
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

async def call_gemini(image_b64: str, content_type: str, api_key: str, model: str, retry: bool = False) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    prompt = SYSTEM_PROMPT
    if retry:
        prompt += "\n\nThe previous attempt produced invalid JSON. Ensure the output is strictly valid JSON matching the schema."

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": content_type,
                            "data": image_b64
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json"
        }
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]

async def extract_bill(image_bytes: bytes, content_type: str = "image/jpeg") -> dict:
    load_dotenv(override=True)
    provider = os.getenv("VISION_PROVIDER", "openai").lower()
    api_key = os.getenv("VISION_API_KEY", "").strip()
    
    # If API key is provided, use cloud vision LLM
    if api_key and api_key != "your-api-key-here":
        if provider in ["google", "gemini"]:
            model = os.getenv("VISION_MODEL", "gemini-1.5-flash")
            provider_fn = call_gemini
        elif provider == "anthropic":
            model = os.getenv("VISION_MODEL", "claude-3-5-sonnet-20240620")
            provider_fn = call_anthropic
        else:
            model = os.getenv("VISION_MODEL", "gpt-4o")
            provider_fn = call_openai

        image_b64 = base64.b64encode(image_bytes).decode('utf-8')
        try:
            raw_response = await provider_fn(image_b64, content_type, api_key, model, retry=False)
            parsed = _process_response_json(raw_response)
            return _convert_to_paise_dict(parsed)
        except Exception as e:
            print(f"Cloud vision error ({provider}): {e}, attempting retry...")
            try:
                raw_response = await provider_fn(image_b64, content_type, api_key, model, retry=True)
                parsed = _process_response_json(raw_response)
                return _convert_to_paise_dict(parsed)
            except Exception as retry_e:
                print(f"Cloud vision retry failed: {retry_e}. Falling back to local OCR on your image.")

    # Real OCR extraction directly on the uploaded image bytes
    return extract_with_local_ocr(image_bytes)
