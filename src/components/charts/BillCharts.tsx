"use client";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useCurrency } from "@/lib/currency-context";

interface Member { id: string; name: string }
interface Split { amount: number; settled: boolean; member: Member }
interface Bill { id: string; title: string; amount: number; paidBy: Member; splits: Split[] }
interface Group { members: Member[]; bills: Bill[] }

const PALETTE = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#ec4899", "#f97316",
  "#84cc16", "#6b7280",
];

function buildBillBreakdown(bills: Bill[]) {
  // Aggregate by title (sum if same title appears multiple times)
  const map: Record<string, number> = {};
  for (const b of bills) {
    map[b.title] = (map[b.title] ?? 0) + b.amount;
  }
  return Object.entries(map)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function buildMemberStats(group: Group) {
  const paid: Record<string, number> = {};
  const owes: Record<string, number> = {};

  for (const m of group.members) {
    paid[m.id] = 0;
    owes[m.id] = 0;
  }

  for (const b of group.bills) {
    paid[b.paidBy.id] = (paid[b.paidBy.id] ?? 0) + b.amount;
    for (const s of b.splits) {
      if (!s.settled && s.member) {
        owes[s.member.id] = (owes[s.member.id] ?? 0) + s.amount;
      }
    }
  }

  return group.members.map((m) => ({
    name: m.name.length > 10 ? m.name.slice(0, 9) + "…" : m.name,
    fullName: m.name,
    paid: paid[m.id] ?? 0,
    owes: owes[m.id] ?? 0,
  }));
}

function CurrencyTooltip({ active, payload, label }: Record<string, unknown>) {
  const { format } = useCurrency();
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      {label && <p className="font-semibold text-gray-700 mb-1">{String(label)}</p>}
      {payload.map((p: Record<string, unknown>) => (
        <p key={String(p.name)} style={{ color: String(p.color) }}>
          {String(p.name)}: {format(Number(p.value))}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: Record<string, unknown>) {
  const { format } = useCurrency();
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const item = payload[0] as Record<string, unknown>;
  const fill = (item.payload as Record<string, unknown>)?.fill as string;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700">{String(item.name)}</p>
      <p style={{ color: fill }}>{format(Number(item.value))}</p>
    </div>
  );
}

interface Props { group: Group }

export default function BillCharts({ group }: Props) {
  const { format } = useCurrency();
  const billBreakdown = buildBillBreakdown(group.bills);
  const memberStats = buildMemberStats(group);
  const hasBills = group.bills.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* Donut — spending per bill */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h4 className="text-base font-semibold text-gray-800 mb-1">Spending per Bill</h4>
        <p className="text-xs text-gray-400 mb-4">Which expenses cost the most</p>
        {!hasBills ? (
          <div className="flex items-center justify-center h-52 text-gray-300 text-sm">
            No bills yet
          </div>
        ) : (
          <>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={billBreakdown}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {billBreakdown.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    formatter={(v) => <span className="text-xs text-gray-600">{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-1">
              {billBreakdown.map((r, i) => (
                <div key={r.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: PALETTE[i % PALETTE.length] }}
                    />
                    <span className="text-gray-600 truncate max-w-36">{r.name}</span>
                  </span>
                  <span className="font-medium text-gray-800">{format(r.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bar chart — who paid vs who owes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h4 className="text-base font-semibold text-gray-800 mb-1">Paid vs Owes per Member</h4>
        <p className="text-xs text-gray-400 mb-4">Total paid and outstanding balance</p>
        {!hasBills ? (
          <div className="flex items-center justify-center h-52 text-gray-300 text-sm">
            No bills yet
          </div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberStats} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
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
                  formatter={(v) => (
                    <span className="text-xs text-gray-600">
                      {v === "paid" ? "Total paid" : "Still owes"}
                    </span>
                  )}
                />
                <Bar dataKey="paid" name="paid" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="owes" name="owes" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
