// Amounts are stored in the currency's minor units (cents, kobo...). Each watch keeps its store's own currency.
export function money(cents: number, currency = "USD") {
  const whole = cents % 100 === 0;
  const digits = { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 };
  if (currency === "USD") return `$${(cents / 100).toLocaleString("en-US", digits)}`;
  try {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", ...digits });
  } catch {
    return `${currency} ${(cents / 100).toLocaleString("en-US", digits)}`;
  }
}

// The symbol alone (for "$ [70]" style inputs): "$", "₦", "£"...
export function currencySymbol(currency = "USD") {
  try {
    return (0).toLocaleString("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).replace(/[\d\s.,]/g, "") || currency;
  } catch {
    return currency;
  }
}

export function ago(date: Date | string | null | undefined) {
  if (!date) return "not yet";
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function shortDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
