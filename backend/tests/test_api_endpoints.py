from fastapi.testclient import TestClient
from backend.main import app
from backend.demo_data import get_demo_bill
from backend.models.bill import Bill, BillItem, Tax, Member, ItemAssignment

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_demo_endpoint():
    response = client.post("/api/bills/demo")
    assert response.status_code == 200
    data = response.json()
    assert "bill" in data
    assert "members" in data
    assert "assignments" in data
    assert len(data["members"]) == 3
    assert data["bill"]["currency"] == "INR"
    assert data["bill"]["subtotal"] == 94000
    assert data["bill"]["total"] == 98400

def test_validate_bill_endpoint_success():
    demo = get_demo_bill()
    response = client.post("/api/bills/validate", json={"bill": demo["bill"]})
    assert response.status_code == 200
    val = response.json()
    assert val["is_valid"] is True
    assert val["calculated_total"] == 98400
    assert val["difference"] == 0

def test_validate_bill_endpoint_mismatch():
    demo = get_demo_bill()
    bad_bill = dict(demo["bill"])
    bad_bill["total"] = 100000  # Incorrect printed total
    response = client.post("/api/bills/validate", json={"bill": bad_bill})
    assert response.status_code == 200
    val = response.json()
    assert val["is_valid"] is False
    assert val["difference"] == -1600  # calculated (98400) - printed (100000)

def test_calculate_endpoint_success():
    demo = get_demo_bill()
    response = client.post("/api/bills/calculate", json=demo)
    assert response.status_code == 200
    res = response.json()
    assert res["verified"] is True
    assert res["bill_total"] == 98400
    assert res["calculated_total"] == 98400
    assert res["difference"] == 0
    assert len(res["person_breakdowns"]) == 3
    
    # Check that sum of individual totals equals calculated_total exactly
    person_sum = sum(p["total"] for p in res["person_breakdowns"])
    assert person_sum == 98400
    assert any("Tax and service charge allocated in proportion" in n for n in res["notes"])
    assert any("Discount allocated proportionally" in n for n in res["notes"])

def test_calculate_endpoint_fewer_than_2_members():
    demo = get_demo_bill()
    demo["members"] = [{"id": "m-1", "name": "Rahul"}]
    response = client.post("/api/bills/calculate", json=demo)
    assert response.status_code == 400
    assert "At least 2 members" in response.json()["detail"]

def test_calculate_endpoint_unassigned_item():
    demo = get_demo_bill()
    # Remove assignment for item-2
    demo["assignments"] = [a for a in demo["assignments"] if a["item_id"] != "item-2"]
    response = client.post("/api/bills/calculate", json=demo)
    assert response.status_code == 400
    assert "is not assigned to anyone" in response.json()["detail"]

def test_calculate_uneven_split_reconciliation():
    # Odd rupee split 3 ways: 100 split 3 ways -> 33, 33, 34
    bill = {
        "restaurant_name": "Test Cafe",
        "currency": "INR",
        "items": [
            {"id": "i1", "name": "Coffee", "quantity": 1, "unit_price": 100, "total_price": 100, "confidence": "high"}
        ],
        "subtotal": 100,
        "discount": None,
        "taxes": [],
        "service_charge": None,
        "total": 100,
        "warnings": []
    }
    members = [
        {"id": "m1", "name": "A"},
        {"id": "m2", "name": "B"},
        {"id": "m3", "name": "C"}
    ]
    assignments = [
        {"item_id": "i1", "member_ids": ["m1", "m2", "m3"]}
    ]
    response = client.post("/api/bills/calculate", json={
        "bill": bill,
        "members": members,
        "assignments": assignments
    })
    assert response.status_code == 200
    res = response.json()
    assert res["calculated_total"] == 100
    assert res["verified"] is True
    shares = [p["total"] for p in res["person_breakdowns"]]
    assert shares == [33, 33, 34]
    assert sum(shares) == 100
