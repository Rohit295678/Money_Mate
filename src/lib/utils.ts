export const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "\u20ac" },
  { code: "GBP", name: "British Pound", symbol: "\u00a3" },
  { code: "INR", name: "Indian Rupee", symbol: "\u20b9" },
  { code: "JPY", name: "Japanese Yen", symbol: "\u00a5" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CNY", name: "Chinese Yuan", symbol: "\u00a5" },
  { code: "AED", name: "UAE Dirham", symbol: "\u062f.\u0625" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "KRW", name: "South Korean Won", symbol: "\u20a9" },
  { code: "SAR", name: "Saudi Riyal", symbol: "\u0631.\u0633" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Bills & Utilities",
  "Healthcare",
  "Education",
  "Travel",
  "Personal Care",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining": "#10b981",
  Transportation: "#3b82f6",
  Shopping: "#f59e0b",
  Entertainment: "#8b5cf6",
  "Bills & Utilities": "#ef4444",
  Healthcare: "#06b6d4",
  Education: "#ec4899",
  Travel: "#f97316",
  "Personal Care": "#84cc16",
  Other: "#6b7280",
};

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getProgressColor(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-yellow-500";
  return "bg-emerald-500";
}
