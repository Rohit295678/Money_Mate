"use client";
import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface Member { id: string; name: string; email: string | null }
interface Split { id: string; member_id: string; amount: number; settled: boolean; member: Member }
interface Bill { id: string; title: string; amount: number; date: string; paidBy: Member; splits: Split[] }
interface Group { id: string; name: string; members: Member[]; bills: Bill[] }

function calcBalances(group: Group): { from: string; to: string; amount: number }[] {
  const net: Record<string, number> = {};
  group.members.forEach((m) => (net[m.id] = 0));
  group.bills.forEach((b) => {
    net[b.paidBy.id] = (net[b.paidBy.id] ?? 0) + b.amount;
    b.splits.forEach((s) => {
      if (!s.settled && s.member) net[s.member.id] = (net[s.member.id] ?? 0) - s.amount;
    });
  });

  const creditors = Object.entries(net).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const debtors = Object.entries(net).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const result: { from: string; to: string; amount: number }[] = [];

  let ci = 0; let di = 0;
  const c = creditors.map(([id, amt]) => ({ id, amt }));
  const d = debtors.map(([id, amt]) => ({ id, amt: -amt }));

  while (ci < c.length && di < d.length) {
    const pay = Math.min(c[ci].amt, d[di].amt);
    if (pay > 0.01) result.push({ from: d[di].id, to: c[ci].id, amount: pay });
    c[ci].amt -= pay; d[di].amt -= pay;
    if (c[ci].amt < 0.01) ci++;
    if (d[di].amt < 0.01) di++;
  }
  return result;
}

export default function BillsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"bills" | "settle">("bills");
  const [newGroup, setNewGroup] = useState({ name: "", members: "" });
  const [newBill, setNewBill] = useState({ title: "", amount: "", memberId: "" });
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function fetchGroups() {
    const res = await fetch("/api/groups");
    const data = await res.json();
    setGroups(data);
    if (!selected && data.length > 0) setSelected(data[0].id);
  }

  useEffect(() => { fetchGroups(); }, []);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const members = newGroup.members.split(",").map((m) => ({ name: m.trim() })).filter((m) => m.name);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroup.name, members }),
    });
    const grp = await res.json();
    setNewGroup({ name: "", members: "" });
    setShowGroupForm(false);
    setLoading(false);
    await fetchGroups();
    setSelected(grp.id);
  }

  async function addBill(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    await fetch(`/api/groups/${selected}/bills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newBill, amount: parseFloat(newBill.amount), splitType: "equal" }),
    });
    setNewBill({ title: "", amount: "", memberId: "" });
    setLoading(false);
    fetchGroups();
  }

  async function deleteGroup(groupId: string, groupName: string) {
    if (!confirm(`Delete group "${groupName}" and all its bills? This cannot be undone.`)) return;
    await fetch(`/api/groups?id=${groupId}`, { method: "DELETE" });
    // If the deleted group was selected, clear selection
    if (selected === groupId) setSelected(null);
    fetchGroups();
  }

  async function settleSplit(splitId: string) {
    if (!selected) return;
    await fetch(`/api/groups/${selected}/bills`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ splitId }),
    });
    fetchGroups();
  }

  const group = groups.find((g) => g.id === selected);
  const balances = group ? calcBalances(group) : [];
  const memberName = (id: string) => group?.members.find((m) => m.id === id)?.name ?? id;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Bill Splitter</h2>
          <p className="text-sm text-gray-500 mt-1">Share costs fairly with friends</p>
        </div>
        <button onClick={() => setShowGroupForm((p) => !p)}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition">
          + New Group
        </button>
      </div>

      {showGroupForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Create Group</h3>
          <form onSubmit={createGroup} className="flex flex-wrap gap-3">
            <input type="text" placeholder="Group name (e.g. Weekend Trip)" value={newGroup.name}
              onChange={(e) => setNewGroup((p) => ({ ...p, name: e.target.value }))} required
              className="flex-1 min-w-48 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <input type="text" placeholder="Members (comma-separated: Alice, Bob, Carol)" value={newGroup.members}
              onChange={(e) => setNewGroup((p) => ({ ...p, members: e.target.value }))} required
              className="flex-1 min-w-64 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
              {loading ? "Creating..." : "Create"}
            </button>
          </form>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400 text-sm">
          No groups yet. Create one to start splitting bills!
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide px-2">Your Groups</p>
            {groups.map((g) => (
              <div key={g.id} className="flex items-center gap-1 group/item">
                <button onClick={() => setSelected(g.id)}
                  className={`flex-1 text-left px-4 py-3 rounded-xl text-sm font-medium transition ${
                    selected === g.id
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-white text-gray-700 border border-gray-100 hover:bg-gray-50"
                  }`}>
                  {g.name}
                  <span className="block text-xs text-gray-400">{g.members.length} members</span>
                </button>
                <button
                  onClick={() => deleteGroup(g.id, g.name)}
                  title="Delete group"
                  className="opacity-0 group-hover/item:opacity-100 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <polyline points="3 6 5 6 21 6" strokeWidth="2" />
                    <path d="M19 6l-1 14H6L5 6" strokeWidth="2" />
                    <path d="M10 11v6M14 11v6" strokeWidth="2" />
                    <path d="M9 6V4h6v2" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {group && (
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex gap-3 mb-4">
                  {(["bills", "settle"] as const).map((v) => (
                    <button key={v} onClick={() => setView(v)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition ${view === v ? "bg-emerald-500 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                      {v === "settle" ? "Settle Up" : "Bills"}
                    </button>
                  ))}
                </div>

                {view === "bills" && (
                  <>
                    <form onSubmit={addBill} className="flex flex-wrap gap-2 mb-4">
                      <input type="text" placeholder="Bill title" value={newBill.title}
                        onChange={(e) => setNewBill((p) => ({ ...p, title: e.target.value }))} required
                        className="flex-1 min-w-32 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                      <input type="number" step="0.01" placeholder="Amount ($)" value={newBill.amount}
                        onChange={(e) => setNewBill((p) => ({ ...p, amount: e.target.value }))} required
                        className="w-36 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                      <select value={newBill.memberId} onChange={(e) => setNewBill((p) => ({ ...p, memberId: e.target.value }))} required
                        className="flex-1 min-w-32 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                        <option value="">Paid by...</option>
                        {group.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <button type="submit" disabled={loading}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
                        {loading ? "..." : "Add Bill"}
                      </button>
                    </form>
                    <div className="divide-y divide-gray-50">
                      {group.bills.length === 0 && (
                        <p className="text-gray-400 text-sm py-8 text-center">No bills yet. Add the first one!</p>
                      )}
                      {group.bills.map((b) => (
                        <div key={b.id} className="py-3">
                          <div className="flex justify-between mb-2">
                            <div>
                              <p className="font-medium text-sm text-gray-800">{b.title}</p>
                              <p className="text-xs text-gray-400">Paid by {b.paidBy.name}</p>
                            </div>
                            <p className="font-semibold text-gray-800">{formatCurrency(b.amount)}</p>
                          </div>
                          <div className="space-y-1">
                            {b.splits.map((s) => (
                              <div key={s.id} className="flex items-center justify-between text-xs">
                                <span className={s.settled ? "line-through text-gray-300" : "text-gray-500"}>
                                  {s.member.name}: {formatCurrency(s.amount)}
                                </span>
                                {!s.settled && (
                                  <button onClick={() => settleSplit(s.id)}
                                    className="text-emerald-500 hover:text-emerald-700 font-medium">
                                    Mark settled
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {view === "settle" && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">Optimal settlement plan to minimize transactions:</p>
                    {balances.length === 0 ? (
                      <p className="text-emerald-600 font-medium text-sm py-4 text-center">All settled up! Everyone is even.</p>
                    ) : (
                      balances.map((b, i) => (
                        <div key={i} className="flex items-center justify-between bg-orange-50 rounded-xl px-4 py-3">
                          <p className="text-sm font-medium text-gray-800">
                            <span className="text-red-600">{memberName(b.from)}</span>
                            {" owes "}
                            <span className="text-emerald-600">{memberName(b.to)}</span>
                          </p>
                          <span className="font-bold text-orange-600">{formatCurrency(b.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
