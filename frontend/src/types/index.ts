export interface BillItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface Tax {
  name: string;
  rate: number | null;
  amount: number;
  confidence: 'high' | 'medium' | 'low' | 'absent';
}

export interface Bill {
  restaurant_name: string | null;
  currency: string;
  items: BillItem[];
  subtotal: number | null;
  discount: number | null;
  taxes: Tax[];
  service_charge: number | null;
  total: number | null;
  extraction_confidence: Record<string, string> | null;
  warnings: string[];
}

export interface Member {
  id: string;
  name: string;
}

export interface ItemAssignment {
  item_id: string;
  member_ids: string[];
}

export interface PersonItemLine {
  item_id: string;
  item_name: string;
  item_total: number;
  share_amount: number;
  shared_with_count: number;
}

export interface TaxShare {
  tax_name: string;
  amount: number;
}

export interface PersonBreakdown {
  member: Member;
  items: PersonItemLine[];
  item_subtotal: number;
  discount_share: number;
  tax_shares: TaxShare[];
  service_charge_share: number;
  total: number;
}

export interface SplitResult {
  person_breakdowns: PersonBreakdown[];
  bill_total: number | null;
  calculated_total: number;
  difference: number;
  verified: boolean;
  notes: string[];
}

export interface ValidationResult {
  is_valid: boolean;
  calculated_total: number;
  printed_total: number | null;
  difference: number;
  message: string;
}

export interface DemoData {
  bill: Bill;
  members: Member[];
  assignments: ItemAssignment[];
}
