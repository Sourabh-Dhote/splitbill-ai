export function formatMoney(paise: number, currency: string = "INR"): string {
  const major = Math.floor(Math.abs(paise) / 100);
  const minor = Math.abs(paise) % 100;
  const sign = paise < 0 ? "-" : "";
  const symbol = currency === "INR" ? "₹" : "$";
  return `${sign}${symbol}${major}.${minor.toString().padStart(2, '0')}`;
}

// Convert display string to paise for editing
export function toPaise(rupees: string): number {
  const num = parseFloat(rupees);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

// Convert paise to display string (just the number, no symbol)
export function toRupees(paise: number): string {
  return (paise / 100).toFixed(2);
}
