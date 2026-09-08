from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
import backend.services.vision_service as vision_service
from backend.services.bill_calculator import calculate_split, validate_bill
from backend.models.bill import (
    Bill, BillItem, Tax, Member, ItemAssignment,
    SplitRequest, SplitResult, ValidateRequest, ValidationResult
)
from backend.demo_data import get_demo_bill

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "ok"}

@router.post("/bills/extract", response_model=Bill)
async def extract_bill_endpoint(images: List[UploadFile] = File(...)):
    if not images:
        raise HTTPException(status_code=400, detail="At least one image is required")
    if len(images) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 images allowed")

    for img in images:
        contents = await img.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image size exceeds 10MB")
        await img.seek(0)

    try:
        merged_items = []
        restaurant_name = None
        subtotal = None
        discount = None
        service_charge = None
        total = None
        merged_taxes = []
        merged_warnings = []
        currency = "INR"

        for img in images:
            contents = await img.read()
            bill_dict = await vision_service.extract_bill(contents, content_type=img.content_type or "image/jpeg")
            
            if not isinstance(bill_dict, dict):
                continue

            if restaurant_name is None and bill_dict.get("restaurant_name"):
                restaurant_name = bill_dict["restaurant_name"]
            if subtotal is None and bill_dict.get("subtotal") is not None:
                subtotal = bill_dict["subtotal"]
            if discount is None and bill_dict.get("discount") is not None:
                discount = bill_dict["discount"]
            if service_charge is None and bill_dict.get("service_charge") is not None:
                service_charge = bill_dict["service_charge"]
            if total is None and bill_dict.get("total") is not None:
                total = bill_dict["total"]
            if not merged_taxes and bill_dict.get("taxes"):
                merged_taxes = bill_dict["taxes"]

            if bill_dict.get("warnings"):
                merged_warnings.extend(bill_dict["warnings"])

            raw_items = bill_dict.get("items", [])
            for raw_item in raw_items:
                merged_items.append(raw_item)

        # Generate unique ids for items if missing or duplicate
        parsed_items: list[BillItem] = []
        for idx, item in enumerate(merged_items):
            item_id = item.get("id") or f"item-{idx + 1}"
            qty = int(item.get("quantity") or 1)
            unit_p = int(item.get("unit_price") or 0)
            total_p = int(item.get("total_price") or (qty * unit_p))
            conf = item.get("confidence")
            if conf not in ["high", "medium", "low"]:
                conf = "high"
            parsed_items.append(
                BillItem(
                    id=item_id,
                    name=item.get("name") or f"Item {idx + 1}",
                    quantity=qty,
                    unit_price=unit_p,
                    total_price=total_p,
                    confidence=conf
                )
            )

        parsed_taxes: list[Tax] = []
        for tax in merged_taxes:
            t_conf = tax.get("confidence", "high")
            if t_conf not in ["high", "medium", "low", "absent"]:
                t_conf = "high"
            parsed_taxes.append(
                Tax(
                    name=tax.get("name", "Tax"),
                    rate=tax.get("rate"),
                    amount=int(tax.get("amount") or 0),
                    confidence=t_conf
                )
            )

        return Bill(
            restaurant_name=restaurant_name,
            currency=currency,
            items=parsed_items,
            subtotal=subtotal,
            discount=discount,
            taxes=parsed_taxes,
            service_charge=service_charge,
            total=total,
            warnings=merged_warnings
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail="Couldn't read that bill — try a clearer photo, or enter it by hand"
        )

@router.post("/bills/validate", response_model=ValidationResult)
async def validate_bill_endpoint(request: ValidateRequest):
    return validate_bill(request.bill)

@router.post("/bills/calculate", response_model=SplitResult)
async def calculate_split_endpoint(request: SplitRequest):
    if len(request.members) < 2:
        raise HTTPException(status_code=400, detail="At least 2 members are required")

    assignment_map = {a.item_id: a.member_ids for a in request.assignments}
    for item in request.bill.items:
        assigned = assignment_map.get(item.id, [])
        if not assigned:
            raise HTTPException(status_code=400, detail=f"Item '{item.name}' is not assigned to anyone")

    return calculate_split(request.bill, request.members, request.assignments)

@router.post("/bills/demo")
async def demo_bill():
    return get_demo_bill()
