"use client";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { CATEGORY_COLORS } from "@/lib/utils";
import { useCurrency } from "@/lib/currency-context";

interface CategoryRow { category: string; amount: number }
interface BudgetRow { category: string; fullCategory: string; budget: number; spent: number }

interface Props {
  categoryBreakdown: CategoryRow[];
  budgetComparison: BudgetRow[];
}

// Lightweight subset of Recharts' tooltip payload — typed so React 19's
// stricter `unknown` -> ReactNode rules don't block the build.
type TooltipPayloadItem = {
  name?: string | number;
  value?: string | number;
  color?: string;
  payload?: { fill?: string } & Record<string, unknown>;
};
type TooltipRenderProps = {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
  label?: string | number;
};

function CurrencyTooltip({ active, payload, label }: TooltipRenderProps) {
  const { format } = useCurrency();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      {label !== undefined && label !== "" && (
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
      )}
      {payload.map((p, i) => (
        <p key={`${p.name ?? i}`} style={{ color: p.color }}>
          {p.name}: {format(Number(p.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: TooltipRenderProps) {
  const { format } = useCurrency();
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700">{item.name}</p>
      <p style={{ color: item.payload?.fill ?? "#000" }}>
        {format(Number(item.value ?? 0))}
      </p>
    </div>
  );
}

export default function OverviewCharts({ categoryBreakdown, budgetComparison }: Props) {
  const { format } = useCurrency();
  const hasPieData = categoryBreakdown.length > 0;
  const hasBarData = budgetComparison.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Donut / Pie chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Spending by Category</h3>
        <p className="text-xs text-gray-400 mb-4">Breakdown of where your money went</p>
        {!hasPieData ? (
          <div className="flex items-center justify-center h-64 text-gray-300 text-sm">
            No expenses recorded yet
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {categoryBreakdown.map((entry) => (
                    <Cell
                      key={entry.category}
                      fill={CATEGORY_COLORS[entry.category] ?? "#6b7280"}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-gray-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {hasPieData && (
          <div className="mt-3 space-y-1">
            {categoryBreakdown.map((r) => (
              <div key={r.category} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: CATEGORY_COLORS[r.category] ?? "#6b7280" }}
                  />
                  <span className="text-gray-600">{r.category}</span>
                </span>
                <span className="font-medium text-gray-800">{format(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bar chart — Budget vs Actual */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Budget vs Actual</h3>
        <p className="text-xs text-gray-400 mb-4">How close you are to each category limit</p>
        {!hasBarData ? (
          <div className="flex items-center justify-center h-64 text-gray-300 text-sm">
            No budgets or expenses recorded yet
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetComparison} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  tickFormatter={(v) => format(v).replace(/\.00$/, "")}
                  width={72}
                />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => (
                    <span className="text-xs text-gray-600">
                      {value === "budget" ? "Budget limit" : "Actual spent"}
                    </span>
                  )}
                />
                <Bar dataKey="budget" name="budget" fill="#bfdbfe" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" name="spent" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
