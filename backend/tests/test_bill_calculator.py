import pytest
import random
from backend.models.bill import (
    Bill, BillItem, Tax, Member, ItemAssignment
)
from backend.services.bill_calculator import (
    distribute_proportionally, split_item_equally, calculate_split, validate_bill
)

def test_distribute_proportionally_basic():
    # Rahul 400, Priya 300, Aman 100 -> Total 80
    res = distribute_proportionally(80_00, [400_00, 300_00, 100_00])
    assert res == [40_00, 30_00, 10_00]

def test_distribute_proportionally_rounding():
    # 100 divided into 3 equal shares
    res = distribute_proportionally(100, [1, 1, 1])
    assert res == [33, 33, 34]
    assert sum(res) == 100

def test_split_item_equally_even():
    res = split_item_equally(100, 2)
    assert res == [50, 50]

def test_split_item_equally_uneven():
    res = split_item_equally(40_00, 3)
    assert res == [13_33, 13_33, 13_34]
    assert sum(res) == 40_00

def test_normal_bill_no_discount():
    bill = Bill(
        items=[
            BillItem(id="i1", name="Pizza", unit_price=1000, total_price=1000)
        ],
        subtotal=1000,
        total=1000
    )
    members = [Member(id="m1", name="A"), Member(id="m2", name="B")]
    assignments = [ItemAssignment(item_id="i1", member_ids=["m1", "m2"])]
    
    res = calculate_split(bill, members, assignments)
    assert res.calculated_total == 1000
    assert res.verified
    assert len(res.person_breakdowns) == 2
    assert res.person_breakdowns[0].total == 500
    assert res.person_breakdowns[1].total == 500

def test_bill_with_discount():
    bill = Bill(
        items=[
            BillItem(id="i1", name="Pizza", unit_price=1000, total_price=1000),
            BillItem(id="i2", name="Burger", unit_price=500, total_price=500)
        ],
        subtotal=1500,
        discount=300, # 20% discount
        total=1200
    )
    m1 = Member(id="m1", name="A")
    m2 = Member(id="m2", name="B")
    
    assignments = [
        ItemAssignment(item_id="i1", member_ids=["m1"]), # M1 pays 1000
        ItemAssignment(item_id="i2", member_ids=["m2"])  # M2 pays 500
    ]
    
    res = calculate_split(bill, [m1, m2], assignments)
    
    # discount shares: m1 should get 1000/1500 * 300 = 200, m2 should get 500/1500 * 300 = 100
    assert res.person_breakdowns[0].discount_share == 200
    assert res.person_breakdowns[0].total == 800
    assert res.person_breakdowns[1].discount_share == 100
    assert res.person_breakdowns[1].total == 400
    
    assert res.calculated_total == 1200
    assert any("Discount allocated proportionally" in n for n in res.notes)

def test_bill_with_gst_and_service_charge():
    bill = Bill(
        items=[
            BillItem(id="i1", name="Pizza", unit_price=1000, total_price=1000)
        ],
        subtotal=1000,
        taxes=[Tax(name="GST", amount=50)],
        service_charge=100,
        total=1150
    )
    m1 = Member(id="m1", name="A")
    m2 = Member(id="m2", name="B")
    assignments = [ItemAssignment(item_id="i1", member_ids=["m1", "m2"])]
    
    res = calculate_split(bill, [m1, m2], assignments)
    # Each gets 500 subtotal. Tax is 50 -> 25 each. SC is 100 -> 50 each.
    # Total for each = 500 + 25 + 50 = 575
    assert res.person_breakdowns[0].total == 575
    assert res.person_breakdowns[1].total == 575
    assert res.calculated_total == 1150
    assert any("Tax and service charge allocated" in n for n in res.notes)

def test_multiple_shared_items():
    bill = Bill(
        items=[
            BillItem(id="i1", name="A", unit_price=100, total_price=100),
            BillItem(id="i2", name="B", unit_price=200, total_price=200)
        ],
        subtotal=300, total=300
    )
    m1 = Member(id="m1", name="M1")
    m2 = Member(id="m2", name="M2")
    m3 = Member(id="m3", name="M3")
    
    assignments = [
        ItemAssignment(item_id="i1", member_ids=["m1", "m2"]), # 50 each
        ItemAssignment(item_id="i2", member_ids=["m2", "m3"])  # 100 each
    ]
    
    res = calculate_split(bill, [m1, m2, m3], assignments)
    assert res.person_breakdowns[0].total == 50
    assert res.person_breakdowns[1].total == 150
    assert res.person_breakdowns[2].total == 100

def test_one_person_items():
    bill = Bill(
        items=[
            BillItem(id="i1", name="A", unit_price=100, total_price=100)
        ],
        subtotal=100, total=100
    )
    m1 = Member(id="m1", name="M1")
    res = calculate_split(bill, [m1], [ItemAssignment(item_id="i1", member_ids=["m1"])])
    assert res.person_breakdowns[0].total == 100

def test_everyone_shared_items():
    bill = Bill(
        items=[
            BillItem(id="i1", name="A", unit_price=90, total_price=90)
        ],
        subtotal=90, total=90
    )
    m1 = Member(id="m1", name="M1")
    m2 = Member(id="m2", name="M2")
    m3 = Member(id="m3", name="M3")
    res = calculate_split(bill, [m1, m2, m3], [ItemAssignment(item_id="i1", member_ids=["m1", "m2", "m3"])])
    assert res.person_breakdowns[0].total == 30
    assert res.person_breakdowns[1].total == 30
    assert res.person_breakdowns[2].total == 30

def test_validate_bill_mismatch():
    bill = Bill(
        items=[BillItem(id="i1", name="A", unit_price=100, total_price=100)],
        subtotal=100,
        total=120
    )
    val = validate_bill(bill)
    assert not val.is_valid
    assert val.difference == -20

def test_validate_bill_match():
    bill = Bill(
        items=[BillItem(id="i1", name="A", unit_price=100, total_price=100)],
        subtotal=100,
        taxes=[Tax(name="T", amount=10)],
        total=110
    )
    val = validate_bill(bill)
    assert val.is_valid

@pytest.mark.parametrize("iteration", range(100))
def test_property_split_reconciliation(iteration):
    random.seed(iteration)
    
    num_members = random.randint(2, 5)
    members = [Member(id=f"m{i}", name=f"Person{i}") for i in range(num_members)]
    
    num_items = random.randint(1, 10)
    items = []
    assignments = []
    
    for i in range(num_items):
        price = random.randint(10, 5000)
        item = BillItem(id=f"i{i}", name=f"Item{i}", unit_price=price, total_price=price)
        items.append(item)
        
        # assign to random subset of members
        assigned_count = random.randint(1, num_members)
        assigned_members = random.sample([m.id for m in members], assigned_count)
        assignments.append(ItemAssignment(item_id=item.id, member_ids=assigned_members))
        
    subtotal = sum(i.total_price for i in items)
    
    discount = random.randint(0, subtotal // 2) if subtotal > 0 else 0
    
    num_taxes = random.randint(0, 2)
    taxes = []
    for i in range(num_taxes):
        taxes.append(Tax(name=f"Tax{i}", amount=random.randint(0, 500)))
        
    sc = random.randint(0, 200)
    
    total = subtotal - discount + sum(t.amount for t in taxes) + sc
    
    bill = Bill(
        items=items,
        subtotal=subtotal,
        discount=discount,
        taxes=taxes,
        service_charge=sc,
        total=total
    )
    
    res = calculate_split(bill, members, assignments)
    
    assert sum(pb.total for pb in res.person_breakdowns) == total
    assert res.calculated_total == total
    assert res.difference == 0
    assert res.verified
