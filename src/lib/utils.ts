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

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function getProgressColor(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-yellow-500";
  return "bg-emerald-500";
}
