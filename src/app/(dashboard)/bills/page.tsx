"use client";
import { useEffect, useRef, useState } from "react";
import { useCurrency } from "@/lib/currency-context";
import dynamic from "next/dynamic";

const BillCharts = dynamic(() => import("@/components/charts/BillCharts"), { ssr: false });

interface Member {
  id: string;
  user_id: string;
  name: string;
  email: string;
}
interface Split {
  id: string;
  member_id: string;
  amount: number;
  settled: boolean;
  member: Member;
}
interface Bill {
  id: string;
  title: string;
  amount: number;
  date: string;
  paidBy: Member;
  splits: Split[];
}
interface SettlementEntry {
  id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  note: string | null;
  date: string;
}
interface Group {
  id: string;
  name: string;
  user_id: string;
  isOwner: boolean;
  members: Member[];
  bills: Bill[];
  settlements: SettlementEntry[];
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

function calcBalances(group: Group): { from: string; to: string; amount: number }[] {
  const net: Record<string, number> = {};
  group.members.forEach((m) => (net[m.id] = 0));

  // Bills: every split contributes (paid - share). The `settled` flag on a
  // split is now purely a display hint ("covered by logged settlements");
  // settlement subtraction below is the single source of truth for math.
  group.bills.forEach((b) => {
    b.splits.forEach((s) => {
      if (!s.member) return;
      net[b.paidBy.id] = (net[b.paidBy.id] ?? 0) + s.amount;
      net[s.member.id] = (net[s.member.id] ?? 0) - s.amount;
    });
  });

  // Settlements: payer (from) becomes "less in debt", payee (to) becomes
  // "less owed". Equivalent to: from gives money to to.
  group.settlements.forEach((s) => {
    net[s.from_member_id] = (net[s.from_member_id] ?? 0) + s.amount;
    net[s.to_member_id] = (net[s.to_member_id] ?? 0) - s.amount;
  });

  const creditors = Object.entries(net).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const debtors = Object.entries(net).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const result: { from: string; to: string; amount: number }[] = [];

  let ci = 0;
  let di = 0;
  const c = creditors.map(([id, amt]) => ({ id, amt }));
  const d = debtors.map(([id, amt]) => ({ id, amt: -amt }));

  while (ci < c.length && di < d.length) {
    const pay = Math.min(c[ci].amt, d[di].amt);
    if (pay > 0.01) result.push({ from: d[di].id, to: c[ci].id, amount: pay });
    c[ci].amt -= pay;
    d[di].amt -= pay;
    if (c[ci].amt < 0.01) ci++;
    if (d[di].amt < 0.01) di++;
  }
  return result;
}

// Reusable user-search dropdown. Pass in a setExclude list to hide users already added.
function UserSearchPicker({
  excludeUserIds,
  excludeEmails,
  onPick,
  placeholder = "Search by name or email…",
}: {
  excludeUserIds: string[];
  excludeEmails: string[];
  onPick: (u: UserOption) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = (await res.json()) as UserOption[];
          const excludedIds = new Set(excludeUserIds);
          const excludedEmails = new Set(excludeEmails.map((e) => e.toLowerCase()));
          setResults(
            data.filter(
              (u) => !excludedIds.has(u.id) && !excludedEmails.has(u.email.toLowerCase())
            )
          );
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, excludeUserIds, excludeEmails]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative flex-1 min-w-64" ref={wrapperRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {loading && <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">
              No registered users found. They need a MoneyMate account first.
            </p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onPick(u);
                setQuery("");
                setResults([]);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm border-b border-gray-50 last:border-b-0"
            >
              <p className="font-medium text-gray-800">{u.name ?? u.email.split("@")[0]}</p>
              <p className="text-xs text-gray-500">{u.email}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberTotals({ group, format }: { group: Group; format: (n: number) => string }) {
  const rows = group.members.map((m) => {
    const totalShare = group.bills
      .flatMap((b) => b.splits)
      .filter((s) => s.member?.id === m.id)
      .reduce((sum, s) => sum + s.amount, 0);

    const totalPaid = group.bills
      .filter((b) => b.paidBy.id === m.id)
      .reduce((sum, b) => sum + b.amount, 0);

    const net = totalPaid - totalShare;
    return { name: m.name, totalShare, totalPaid, net };
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h4 className="text-base font-semibold text-gray-800 mb-1">Total Amount Each Person Spent</h4>
      <p className="text-xs text-gray-400 mb-4">Share = their cut of all bills regardless of who paid</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Member</th>
              <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Share</th>
              <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Paid</th>
              <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Net Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="py-3 pr-4 font-medium text-gray-800">{r.name}</td>
                <td className="py-3 pr-4 text-right text-gray-600">{format(r.totalShare)}</td>
                <td className="py-3 pr-4 text-right text-gray-600">{format(r.totalPaid)}</td>
                <td className="py-3 text-right">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      r.net > 0.01
                        ? "bg-emerald-50 text-emerald-700"
                        : r.net < -0.01
                        ? "bg-red-50 text-red-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {r.net > 0.01 ? "+" : ""}{format(r.net)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-4">
        Net balance: <span className="text-emerald-600 font-medium">green = others owe them</span>
        {" | "}
        <span className="text-red-500 font-medium">red = they still owe others</span>
      </p>
    </div>
  );
}

// Per-member row in the split editor. `included` toggles checkbox; `amount`
// is the editable string; `manual` is true once the user has typed in the
// row, which suppresses auto-rebalancing for that row.
type SplitRow = { included: boolean; amount: string; manual: boolean };

function buildEqualSplit(
  memberIds: string[],
  payerId: string | null,
  total: number,
  prev: Record<string, SplitRow>
): Record<string, SplitRow> {
  const next: Record<string, SplitRow> = {};
  // Determine inclusion: start from prev (preserves user's checkbox edits),
  // payer is always included, default everyone else to included.
  for (const id of memberIds) {
    const wasIncluded = prev[id]?.included ?? true;
    next[id] = {
      included: id === payerId ? true : wasIncluded,
      amount: prev[id]?.amount ?? "",
      manual: prev[id]?.manual ?? false,
    };
  }
  const includedIds = memberIds.filter((id) => next[id].included);
  if (!Number.isFinite(total) || total <= 0 || includedIds.length === 0) {
    for (const id of includedIds) {
      if (!next[id].manual) next[id].amount = "";
    }
    return next;
  }
  // Distribute equally among non-manual rows after subtracting manual sums.
  const manualSum = includedIds
    .filter((id) => next[id].manual)
    .reduce((s, id) => s + (Number(next[id].amount) || 0), 0);
  const remaining = total - manualSum;
  const autoIds = includedIds.filter((id) => !next[id].manual);
  if (autoIds.length > 0) {
    const each = Math.max(0, remaining / autoIds.length);
    // Round to cents to avoid display noise; the final row absorbs the
    // rounding remainder so the sum matches `total`.
    const rounded = Math.floor(each * 100) / 100;
    let leftover = Math.round((remaining - rounded * autoIds.length) * 100) / 100;
    autoIds.forEach((id, idx) => {
      let v = rounded;
      if (idx === autoIds.length - 1) v = Math.round((rounded + leftover) * 100) / 100;
      else {
        // Spread sub-cent leftover across early rows.
        if (leftover >= 0.01) {
          v = Math.round((rounded + 0.01) * 100) / 100;
          leftover = Math.round((leftover - 0.01) * 100) / 100;
        }
      }
      next[id].amount = v > 0 ? v.toFixed(2) : "0";
    });
  }
  return next;
}

export default function BillsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"bills" | "settle">("bills");
  const [groupName, setGroupName] = useState("");
  const [pendingMembers, setPendingMembers] = useState<UserOption[]>([]);
  const [newBill, setNewBill] = useState({ title: "", amount: "", memberId: "" });
  const [splitRows, setSplitRows] = useState<Record<string, SplitRow>>({});
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  // Which Settle Up row is currently being entered. Key = `${from}|${to}`.
  const [settlingRowKey, setSettlingRowKey] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleNote, setSettleNote] = useState("");
  const [showSettleHistory, setShowSettleHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { format, symbol } = useCurrency();

  async function fetchGroups() {
    const res = await fetch("/api/groups");
    if (!res.ok) return;
    const data: Group[] = await res.json();
    setGroups(data);
    if (!selected && data.length > 0) setSelected(data[0].id);
  }

  useEffect(() => {
    fetchGroups();
  }, []);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          memberEmails: pendingMembers.map((m) => m.email),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Failed to create group");
        return;
      }
      const grp: Group = await res.json();
      setGroupName("");
      setPendingMembers([]);
      setShowGroupForm(false);
      await fetchGroups();
      setSelected(grp.id);
    } finally {
      setLoading(false);
    }
  }

  async function addBill(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const total = parseFloat(newBill.amount);
    const includedRows = Object.entries(splitRows).filter(([, r]) => r.included);
    if (includedRows.length === 0) {
      setError("Select at least one member to split among");
      return;
    }
    if (!includedRows.some(([id]) => id === newBill.memberId)) {
      setError("The payer must be included in the split");
      return;
    }
    const sum = includedRows.reduce((s, [, r]) => s + (Number(r.amount) || 0), 0);
    if (Math.abs(sum - total) > 0.01) {
      setError(
        `Split amounts add up to ${format(sum)} but the bill is ${format(total)}. ` +
          `Adjust amounts or click "Reset to equal".`
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${selected}/bills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newBill.title,
          amount: total,
          memberId: newBill.memberId,
          splits: includedRows.map(([memberId, r]) => ({
            memberId,
            amount: Number(r.amount) || 0,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Failed to add bill");
        return;
      }
      setNewBill({ title: "", amount: "", memberId: "" });
      setSplitRows({});
      fetchGroups();
    } finally {
      setLoading(false);
    }
  }

  // Rebalance the split editor whenever the amount, payer, or membership
  // changes — but only auto-fill rows the user hasn't manually edited.
  useEffect(() => {
    const g = groups.find((x) => x.id === selected);
    if (!g) {
      if (Object.keys(splitRows).length > 0) setSplitRows({});
      return;
    }
    const total = parseFloat(newBill.amount);
    setSplitRows((prev) =>
      buildEqualSplit(
        g.members.map((m) => m.id),
        newBill.memberId || null,
        Number.isFinite(total) ? total : 0,
        prev
      )
    );
    // Intentionally exclude `splitRows` from deps to avoid feedback loop;
    // we deliberately read prev inside the setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, newBill.amount, newBill.memberId, groups]);

  function toggleSplitMember(memberId: string) {
    setSplitRows((prev) => {
      const cur = prev[memberId];
      if (!cur) return prev;
      // Payer can't be unchecked
      if (memberId === newBill.memberId) return prev;
      const next = { ...prev, [memberId]: { ...cur, included: !cur.included, manual: false } };
      // Force rebalance: clear manual flags on auto rows so equal split applies.
      for (const id of Object.keys(next)) {
        if (next[id].included && id !== memberId) {
          next[id] = { ...next[id], manual: false };
        }
      }
      const total = parseFloat(newBill.amount);
      return buildEqualSplit(
        Object.keys(next),
        newBill.memberId || null,
        Number.isFinite(total) ? total : 0,
        next
      );
    });
  }

  function setSplitAmount(memberId: string, val: string) {
    setSplitRows((prev) => {
      const cur = prev[memberId];
      if (!cur) return prev;
      return { ...prev, [memberId]: { ...cur, amount: val, manual: true } };
    });
  }

  function resetSplitToEqual() {
    setSplitRows((prev) => {
      const cleared: Record<string, SplitRow> = {};
      for (const id of Object.keys(prev)) {
        cleared[id] = { ...prev[id], amount: "", manual: false };
      }
      const total = parseFloat(newBill.amount);
      return buildEqualSplit(
        Object.keys(cleared),
        newBill.memberId || null,
        Number.isFinite(total) ? total : 0,
        cleared
      );
    });
  }

  async function deleteGroup(groupId: string, groupName: string) {
    if (!confirm(`Delete group "${groupName}" and all its bills? This cannot be undone.`)) return;
    await fetch(`/api/groups?id=${groupId}`, { method: "DELETE" });
    if (selected === groupId) setSelected(null);
    fetchGroups();
  }

  async function deleteBill(billId: string) {
    if (!selected) return;
    await fetch(`/api/groups/${selected}/bills?billId=${billId}`, { method: "DELETE" });
    fetchGroups();
  }

  async function addExistingGroupMember(u: UserOption) {
    if (!selected) return;
    setError(null);
    const res = await fetch(`/api/groups/${selected}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: u.email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Failed to add member");
      return;
    }
    fetchGroups();
  }

  async function removeMember(memberId: string, name: string) {
    if (!selected) return;
    if (!confirm(`Remove ${name} from this group? Their existing bills/splits stay but they won't appear in new ones.`))
      return;
    const res = await fetch(`/api/groups/${selected}/members?memberId=${memberId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Failed to remove member");
      return;
    }
    fetchGroups();
  }

  function startSettling(rowKey: string, defaultAmount: number) {
    setSettlingRowKey(rowKey);
    setSettleAmount(defaultAmount.toFixed(2));
    setSettleNote("");
    setError(null);
  }

  function cancelSettling() {
    setSettlingRowKey(null);
    setSettleAmount("");
    setSettleNote("");
  }

  async function submitSettlement(fromMemberId: string, toMemberId: string, maxOwed: number) {
    if (!selected) return;
    const amt = Number(settleAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a positive amount");
      return;
    }
    if (amt - maxOwed > 0.01) {
      setError(`Cannot settle more than is owed (${format(maxOwed)})`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${selected}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromMemberId,
          toMemberId,
          amount: amt,
          note: settleNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Failed to record settlement");
        return;
      }
      cancelSettling();
      fetchGroups();
    } finally {
      setLoading(false);
    }
  }

  async function deleteSettlement(settlementId: string) {
    if (!selected) return;
    if (!confirm("Undo this settlement? The amount will go back into the outstanding balance."))
      return;
    const res = await fetch(
      `/api/groups/${selected}/settlements?settlementId=${settlementId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Failed to undo settlement");
      return;
    }
    fetchGroups();
  }

  const group = groups.find((g) => g.id === selected);
  const balances = group ? calcBalances(group) : [];
  const memberName = (id: string) => group?.members.find((m) => m.id === id)?.name ?? id;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Bill Splitter</h2>
          <p className="text-sm text-gray-500 mt-1">
            Share costs fairly with friends — only registered users can be added
          </p>
        </div>
        <button
          onClick={() => {
            setShowGroupForm((p) => !p);
            setError(null);
          }}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition"
        >
          + New Group
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold">
            ×
          </button>
        </div>
      )}

      {showGroupForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Create Group</h3>
          <form onSubmit={createGroup} className="space-y-3">
            <input
              type="text"
              placeholder="Group name (e.g. Weekend Trip)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />

            <div>
              <p className="text-xs text-gray-500 mb-2">
                Add members by email — they must already be registered MoneyMate users. You&apos;re added automatically as the owner.
              </p>
              <UserSearchPicker
                excludeUserIds={pendingMembers.map((m) => m.id)}
                excludeEmails={pendingMembers.map((m) => m.email)}
                onPick={(u) => setPendingMembers((p) => [...p, u])}
                placeholder="Search registered users by name or email…"
              />
            </div>

            {pendingMembers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingMembers.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium border border-emerald-200"
                  >
                    {m.name ?? m.email.split("@")[0]}
                    <span className="text-emerald-500/70">{m.email}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingMembers((p) => p.filter((x) => x.id !== m.id))
                      }
                      className="text-emerald-700 hover:text-red-600 font-bold leading-none"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !groupName.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Group"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGroupForm(false);
                  setPendingMembers([]);
                  setGroupName("");
                  setError(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition"
              >
                Cancel
              </button>
            </div>
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
                <button
                  onClick={() => {
                    setSelected(g.id);
                    setShowMembersPanel(false);
                    setError(null);
                  }}
                  className={`flex-1 text-left px-4 py-3 rounded-xl text-sm font-medium transition ${
                    selected === g.id
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-white text-gray-700 border border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {g.name}
                    {!g.isOwner && (
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">
                        member
                      </span>
                    )}
                  </div>
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
                <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
                  <div className="flex gap-3">
                    {(["bills", "settle"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                          view === v ? "bg-emerald-500 text-white" : "text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        {v === "settle" ? "Settle Up" : "Bills"}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowMembersPanel((p) => !p)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                  >
                    {showMembersPanel ? "Hide members" : `Manage members (${group.members.length})`}
                  </button>
                </div>

                {showMembersPanel && (
                  <div className="mb-5 border border-gray-100 rounded-xl p-4 bg-gray-50">
                    <p className="text-xs text-gray-500 mb-2">
                      Add a registered user to this group. Anyone in the group can add or remove members.
                    </p>
                    <UserSearchPicker
                      excludeUserIds={group.members.map((m) => m.user_id)}
                      excludeEmails={group.members.map((m) => m.email)}
                      onPick={addExistingGroupMember}
                      placeholder="Search registered users by name or email…"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {group.members.map((m) => {
                        const isOwner = m.user_id === group.user_id;
                        return (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-2 bg-white text-gray-700 px-3 py-1 rounded-full text-xs font-medium border border-gray-200"
                          >
                            {m.name}
                            <span className="text-gray-400">{m.email}</span>
                            {isOwner ? (
                              <span className="text-emerald-600 text-[10px] uppercase tracking-wide">
                                owner
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => removeMember(m.id, m.name)}
                                className="text-gray-400 hover:text-red-600 font-bold leading-none"
                                aria-label="Remove member"
                                title="Remove from group"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {view === "bills" && (
                  <>
                    <form onSubmit={addBill} className="space-y-3 mb-5">
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          placeholder="Bill title"
                          value={newBill.title}
                          onChange={(e) => setNewBill((p) => ({ ...p, title: e.target.value }))}
                          required
                          className="flex-1 min-w-32 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={`Amount (${symbol})`}
                          value={newBill.amount}
                          onChange={(e) => setNewBill((p) => ({ ...p, amount: e.target.value }))}
                          required
                          className="w-36 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                        <select
                          value={newBill.memberId}
                          onChange={(e) => setNewBill((p) => ({ ...p, memberId: e.target.value }))}
                          required
                          className="flex-1 min-w-32 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                          <option value="">Paid by...</option>
                          {group.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Split editor: visible once both amount and payer are chosen */}
                      {newBill.memberId && parseFloat(newBill.amount) > 0 && group.members.length > 1 && (() => {
                        const total = parseFloat(newBill.amount);
                        const includedSum = Object.entries(splitRows)
                          .filter(([, r]) => r.included)
                          .reduce((s, [, r]) => s + (Number(r.amount) || 0), 0);
                        const diff = total - includedSum;
                        const balanced = Math.abs(diff) < 0.01;
                        return (
                          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                Split among
                              </p>
                              <button
                                type="button"
                                onClick={resetSplitToEqual}
                                className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                              >
                                Reset to equal
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              {group.members.map((m) => {
                                const row = splitRows[m.id] ?? { included: true, amount: "", manual: false };
                                const isPayer = m.id === newBill.memberId;
                                return (
                                  <label
                                    key={m.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
                                      row.included ? "bg-white" : "bg-gray-100 opacity-60"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={row.included}
                                      disabled={isPayer}
                                      onChange={() => toggleSplitMember(m.id)}
                                      className="w-4 h-4 accent-emerald-500"
                                    />
                                    <span className="flex-1 text-sm text-gray-700 truncate">
                                      {m.name}
                                      {isPayer && (
                                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-emerald-600">
                                          payer
                                        </span>
                                      )}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-400">{symbol}</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={row.amount}
                                        disabled={!row.included}
                                        onChange={(e) => setSplitAmount(m.id, e.target.value)}
                                        className="w-20 px-2 py-1 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:bg-gray-50"
                                      />
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="mt-3 flex items-center justify-between text-xs">
                              <span className="text-gray-500">
                                Included: {Object.values(splitRows).filter((r) => r.included).length} of{" "}
                                {group.members.length}
                              </span>
                              <span
                                className={`font-semibold ${
                                  balanced ? "text-emerald-600" : "text-red-500"
                                }`}
                              >
                                {balanced
                                  ? `Balanced: ${format(total)}`
                                  : `${format(includedSum)} of ${format(total)} (${diff > 0 ? "+" : ""}${format(
                                      diff
                                    )} left)`}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                        >
                          {loading ? "..." : "Add Bill"}
                        </button>
                      </div>
                    </form>
                    <div className="divide-y divide-gray-50">
                      {group.bills.length === 0 && (
                        <p className="text-gray-400 text-sm py-8 text-center">
                          No bills yet. Add the first one!
                        </p>
                      )}
                      {group.bills.map((b) => (
                        <div key={b.id} className="py-3 group/bill">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-sm text-gray-800">{b.title}</p>
                              <p className="text-xs text-gray-400">Paid by {b.paidBy.name}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-semibold text-gray-800">{format(b.amount)}</p>
                              <button
                                onClick={() => deleteBill(b.id)}
                                title="Delete bill"
                                className="opacity-0 group-hover/bill:opacity-100 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <polyline points="3 6 5 6 21 6" strokeWidth="2" />
                                  <path d="M19 6l-1 14H6L5 6" strokeWidth="2" />
                                  <path d="M10 11v6M14 11v6" strokeWidth="2" />
                                  <path d="M9 6V4h6v2" strokeWidth="2" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {b.splits.map((s) => (
                              <div key={s.id} className="flex items-center justify-between text-xs">
                                <span className={s.settled ? "line-through text-gray-300" : "text-gray-500"}>
                                  {s.member.name}: {format(s.amount)}
                                </span>
                                {s.settled && (
                                  <span className="text-emerald-500 text-[10px] uppercase tracking-wide">
                                    settled
                                  </span>
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
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        Optimal settlement plan to minimize transactions:
                      </p>
                      {group.settlements.length > 0 && (
                        <button
                          onClick={() => setShowSettleHistory((p) => !p)}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          {showSettleHistory ? "Hide history" : `History (${group.settlements.length})`}
                        </button>
                      )}
                    </div>
                    {balances.length === 0 ? (
                      <p className="text-emerald-600 font-medium text-sm py-4 text-center">
                        All settled up! Everyone is even.
                      </p>
                    ) : (
                      balances.map((b) => {
                        const rowKey = `${b.from}|${b.to}`;
                        const active = settlingRowKey === rowKey;
                        return (
                          <div
                            key={rowKey}
                            className="bg-orange-50 rounded-xl px-4 py-3 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-gray-800">
                                <span className="text-red-600">{memberName(b.from)}</span>
                                {" owes "}
                                <span className="text-emerald-600">{memberName(b.to)}</span>
                              </p>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-orange-600">
                                  {format(b.amount)}
                                </span>
                                {!active && (
                                  <button
                                    onClick={() => startSettling(rowKey, b.amount)}
                                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition"
                                  >
                                    Settle
                                  </button>
                                )}
                              </div>
                            </div>

                            {active && (
                              <div className="bg-white border border-emerald-200 rounded-lg p-3 space-y-2">
                                <div className="flex flex-wrap gap-2 items-center">
                                  <span className="text-xs text-gray-500">Pay {symbol}</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={b.amount}
                                    value={settleAmount}
                                    onChange={(e) => setSettleAmount(e.target.value)}
                                    autoFocus
                                    className="w-28 px-2 py-1 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                  />
                                  <span className="text-xs text-gray-400">
                                    of {format(b.amount)} owed
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSettleAmount(b.amount.toFixed(2))}
                                    className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                                  >
                                    Pay full
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Note (optional)"
                                  value={settleNote}
                                  onChange={(e) => setSettleNote(e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                />
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={cancelSettling}
                                    className="px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-md"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => submitSettlement(b.from, b.to, b.amount)}
                                    disabled={loading || !settleAmount}
                                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                                  >
                                    {loading ? "Saving…" : "Confirm payment"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {showSettleHistory && group.settlements.length > 0 && (
                      <div className="mt-4 border border-gray-100 rounded-xl bg-gray-50 p-3">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                          Settlement history
                        </p>
                        <div className="space-y-1.5 text-xs">
                          {group.settlements.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between bg-white rounded-md px-3 py-2 group/settle"
                            >
                              <div className="min-w-0">
                                <p className="text-gray-700">
                                  <span className="font-medium text-red-600">
                                    {memberName(s.from_member_id)}
                                  </span>
                                  {" → "}
                                  <span className="font-medium text-emerald-600">
                                    {memberName(s.to_member_id)}
                                  </span>
                                  {": "}
                                  <span className="font-semibold text-gray-800">
                                    {format(s.amount)}
                                  </span>
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {new Date(s.date).toLocaleString()}
                                  {s.note ? ` · ${s.note}` : ""}
                                </p>
                              </div>
                              <button
                                onClick={() => deleteSettlement(s.id)}
                                title="Undo settlement"
                                className="opacity-0 group-hover/settle:opacity-100 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <polyline points="3 6 5 6 21 6" strokeWidth="2" />
                                  <path d="M19 6l-1 14H6L5 6" strokeWidth="2" />
                                  <path d="M10 11v6M14 11v6" strokeWidth="2" />
                                  <path d="M9 6V4h6v2" strokeWidth="2" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {group.bills.length > 0 && <BillCharts group={group} />}

              {group.bills.length > 0 && <MemberTotals group={group} format={format} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
