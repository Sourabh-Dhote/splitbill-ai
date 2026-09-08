from backend.models.bill import (
    Bill, Member, ItemAssignment, SplitResult, PersonBreakdown,
    PersonItemLine, TaxShare, ValidationResult
)

def distribute_proportionally(total_paise: int, shares: list[int]) -> list[int]:
    """
    Distributes an amount proportionally based on weights, allocating any rounding remainder
    to the last person.
    """
    total_shares = sum(shares)
    if total_shares == 0:
        return [0] * len(shares)
    
    distributed = []
    for share in shares[:-1]:
        amount = int(round(total_paise * (share / total_shares)))
        distributed.append(amount)
        
    last_amount = total_paise - sum(distributed)
    distributed.append(last_amount)
    
    return distributed

def split_item_equally(total_paise: int, num_people: int) -> list[int]:
    """
    Splits an amount equally among a number of people, allocating any rounding remainder
    to the last person.
    """
    if num_people == 0:
        return []
    
    base_share = total_paise // num_people
    shares = [base_share] * (num_people - 1)
    last_share = total_paise - sum(shares)
    shares.append(last_share)
    
    return shares

def calculate_split(bill: Bill, members: list[Member], assignments: list[ItemAssignment]) -> SplitResult:
    members_dict = {m.id: m for m in members}
    items_dict = {i.id: i for i in bill.items}
    
    breakdowns = {m.id: {
        'member': m,
        'items': [],
        'item_subtotal': 0,
        'discount_share': 0,
        'tax_shares': [],
        'service_charge_share': 0,
        'total': 0
    } for m in members}
    
    for assignment in assignments:
        item = items_dict.get(assignment.item_id)
        if not item or not assignment.member_ids:
            continue
            
        shares = split_item_equally(item.total_price, len(assignment.member_ids))
        
        for member_id, share_amount in zip(assignment.member_ids, shares):
            if member_id in breakdowns:
                line = PersonItemLine(
                    item_id=item.id,
                    item_name=item.name,
                    item_total=item.total_price,
                    share_amount=share_amount,
                    shared_with_count=len(assignment.member_ids)
                )
                breakdowns[member_id]['items'].append(line)
                breakdowns[member_id]['item_subtotal'] += share_amount
                
    member_ids = [m.id for m in members]
    subtotals = [breakdowns[m_id]['item_subtotal'] for m_id in member_ids]
    
    if bill.discount and bill.discount > 0:
        discount_shares = distribute_proportionally(bill.discount, subtotals)
        for m_id, d_share in zip(member_ids, discount_shares):
            breakdowns[m_id]['discount_share'] = d_share
            
    for tax in bill.taxes:
        tax_amounts = distribute_proportionally(tax.amount, subtotals)
        for m_id, t_share in zip(member_ids, tax_amounts):
            breakdowns[m_id]['tax_shares'].append(TaxShare(tax_name=tax.name, amount=t_share))
            
    if bill.service_charge and bill.service_charge > 0:
        sc_shares = distribute_proportionally(bill.service_charge, subtotals)
        for m_id, sc_share in zip(member_ids, sc_shares):
            breakdowns[m_id]['service_charge_share'] = sc_share
            
    for m_id in member_ids:
        b = breakdowns[m_id]
        total_taxes = sum(ts.amount for ts in b['tax_shares'])
        b['total'] = b['item_subtotal'] - b['discount_share'] + total_taxes + b['service_charge_share']
        
    person_breakdowns = [
        PersonBreakdown(**breakdowns[m_id])
        for m_id in member_ids
    ]
    
    calculated_total = sum(pb.total for pb in person_breakdowns)
    difference = calculated_total - bill.total if bill.total is not None else 0
    verified = difference == 0 if bill.total is not None else True
    
    notes = []
    if bill.discount and bill.discount > 0:
        notes.append("Discount allocated proportionally to pre-discount item subtotal")
    if bill.taxes or (bill.service_charge and bill.service_charge > 0):
        notes.append("Tax and service charge allocated in proportion to pre-discount item subtotal")
        
    return SplitResult(
        person_breakdowns=person_breakdowns,
        bill_total=bill.total,
        calculated_total=calculated_total,
        difference=difference,
        verified=verified,
        notes=notes
    )

def validate_bill(bill: Bill) -> ValidationResult:
    calc_subtotal = sum(item.total_price for item in bill.items)
    
    expected_total = calc_subtotal
    if bill.discount:
        expected_total -= bill.discount
    for tax in bill.taxes:
        expected_total += tax.amount
    if bill.service_charge:
        expected_total += bill.service_charge
        
    diff = 0
    msg = []
    if bill.subtotal is not None and bill.subtotal != calc_subtotal:
        msg.append(f"Subtotal mismatch: sum of items is {calc_subtotal}, bill subtotal is {bill.subtotal}.")
        
    if bill.total is not None:
        diff = expected_total - bill.total
        if diff != 0:
            msg.append(f"Total mismatch: calculated {expected_total}, bill total is {bill.total}.")
            
    is_valid = len(msg) == 0
    
    return ValidationResult(
        is_valid=is_valid,
        calculated_total=expected_total,
        printed_total=bill.total,
        difference=diff,
        message=" ".join(msg) if msg else "Valid"
    )
