def get_demo_bill() -> dict:
    bill = {
        "restaurant_name": "The Spice Garden",
        "currency": "INR",
        "items": [
            {
                "id": "item-1",
                "name": "Chicken Biryani",
                "quantity": 2,
                "unit_price": 25000,
                "total_price": 50000,
                "confidence": "high"
            },
            {
                "id": "item-2",
                "name": "Coke",
                "quantity": 1,
                "unit_price": 8000,
                "total_price": 8000,
                "confidence": "high"
            },
            {
                "id": "item-3",
                "name": "Mineral Water",
                "quantity": 1,
                "unit_price": 4000,
                "total_price": 4000,
                "confidence": "high"
            },
            {
                "id": "item-4",
                "name": "Paneer Tikka",
                "quantity": 1,
                "unit_price": 22000,
                "total_price": 22000,
                "confidence": "high"
            },
            {
                "id": "item-5",
                "name": "Naan (2)",
                "quantity": 2,
                "unit_price": 5000,
                "total_price": 10000,
                "confidence": "high"
            }
        ],
        "subtotal": 94000,
        "discount": 5000,
        "taxes": [
            {"name": "CGST 2.5%", "rate": 0.025, "amount": 2350, "confidence": "high"},
            {"name": "SGST 2.5%", "rate": 0.025, "amount": 2350, "confidence": "high"}
        ],
        "service_charge": 4700,
        "total": 98400,
        "extraction_confidence": {
            "subtotal": "high",
            "discount": "high",
            "service_charge": "high",
            "total": "high"
        },
        "warnings": []
    }
    
    members = [
        {"id": "m-1", "name": "Rahul"},
        {"id": "m-2", "name": "Priya"},
        {"id": "m-3", "name": "Aman"}
    ]
    
    assignments = [
        {"item_id": "item-1", "member_ids": ["m-1", "m-2"]},
        {"item_id": "item-2", "member_ids": ["m-3"]},
        {"item_id": "item-3", "member_ids": ["m-1", "m-2", "m-3"]},
        {"item_id": "item-4", "member_ids": ["m-2"]},
        {"item_id": "item-5", "member_ids": ["m-1", "m-2"]}
    ]
    
    return {
        "bill": bill,
        "members": members,
        "assignments": assignments
    }
