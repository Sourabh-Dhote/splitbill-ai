from pydantic import BaseModel
from typing import Optional, Literal

class BillItem(BaseModel):
    id: str
    name: str
    quantity: int = 1
    unit_price: int
    total_price: int
    confidence: Literal["high", "medium", "low"] = "high"

class Tax(BaseModel):
    name: str
    rate: Optional[float] = None
    amount: int
    confidence: Literal["high", "medium", "low", "absent"] = "high"

class Bill(BaseModel):
    restaurant_name: Optional[str] = None
    currency: str = "INR"
    items: list[BillItem]
    subtotal: Optional[int] = None
    discount: Optional[int] = None
    taxes: list[Tax] = []
    service_charge: Optional[int] = None
    total: Optional[int] = None
    extraction_confidence: Optional[dict] = None
    warnings: list[str] = []

class Member(BaseModel):
    id: str
    name: str

class ItemAssignment(BaseModel):
    item_id: str
    member_ids: list[str]

class SplitRequest(BaseModel):
    bill: Bill
    members: list[Member]
    assignments: list[ItemAssignment]

class PersonItemLine(BaseModel):
    item_id: str
    item_name: str
    item_total: int
    share_amount: int
    shared_with_count: int

class TaxShare(BaseModel):
    tax_name: str
    amount: int

class PersonBreakdown(BaseModel):
    member: Member
    items: list[PersonItemLine]
    item_subtotal: int
    discount_share: int
    tax_shares: list[TaxShare]
    service_charge_share: int
    total: int

class SplitResult(BaseModel):
    person_breakdowns: list[PersonBreakdown]
    bill_total: Optional[int]
    calculated_total: int
    difference: int
    verified: bool
    notes: list[str]

class ValidateRequest(BaseModel):
    bill: Bill

class ValidationResult(BaseModel):
    is_valid: bool
    calculated_total: int
    printed_total: Optional[int]
    difference: int
    message: str
