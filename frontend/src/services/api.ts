import { Bill, ValidationResult, SplitResult, Member, ItemAssignment, DemoData } from '../types';

const BASE = '';  // proxy handles /api

export async function extractBill(images: Blob[]): Promise<Bill> {
  const form = new FormData();
  images.forEach((img, i) => form.append('images', img, `bill-${i}.jpg`));
  const res = await fetch(`${BASE}/api/bills/extract`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function validateBill(bill: Bill): Promise<ValidationResult> {
  const res = await fetch(`${BASE}/api/bills/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bill }),
  });
  if (!res.ok) throw new Error('Validation failed');
  return res.json();
}

export async function calculateSplit(bill: Bill, members: Member[], assignments: ItemAssignment[]): Promise<SplitResult> {
  const res = await fetch(`${BASE}/api/bills/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bill, members, assignments }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Calculation failed' }));
    throw new Error(err.detail || 'Calculation failed');
  }
  return res.json();
}

export async function loadDemo(): Promise<DemoData> {
  const res = await fetch(`${BASE}/api/bills/demo`, { method: 'POST' });
  if (!res.ok) throw new Error('Demo load failed');
  return res.json();
}
