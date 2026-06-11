import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

async function assertGroupMember(groupId: string, userId: string) {
  return prisma.groupMember.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
}

// Compute (from -> to) RAW direct debt for this pair, ignoring already-logged
// settlements. This is: sum of unsettled bill_splits where `from` is the
// debtor and `to` was the payer.
async function rawDirectDebt(
  groupId: string,
  fromMemberId: string,
  toMemberId: string
): Promise<number> {
  const debtorSplits = await prisma.billSplit.findMany({
    where: {
      bill: { groupId, memberId: toMemberId },
      memberId: fromMemberId,
      settled: false,
    },
    select: { amount: true },
  });
  const debtSum = debtorSplits.reduce((s, x) => s + x.amount, 0);

  const reverseSplits = await prisma.billSplit.findMany({
    where: {
      bill: { groupId, memberId: fromMemberId },
      memberId: toMemberId,
      settled: false,
    },
    select: { amount: true },
  });
  const reverseSum = reverseSplits.reduce((s, x) => s + x.amount, 0);

  return debtSum - reverseSum;
}

export async function OPTIONS() {
  return corsPreflight();
}

// POST /api/groups/[id]/settlements
// body: { fromMemberId, toMemberId, amount, note? }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { id: groupId } = await params;
  const body = await req.json();
  const fromMemberId: string | undefined = body.fromMemberId;
  const toMemberId: string | undefined = body.toMemberId;
  const note: string | undefined = body.note;
  const amount = Number(body.amount);
  // method is one of: "upi" | "cash" | "other" | undefined (legacy clients).
  const rawMethod = typeof body.method === "string" ? body.method.trim().toLowerCase() : undefined;
  const method =
    rawMethod === "upi" || rawMethod === "cash" || rawMethod === "other" ? rawMethod : undefined;
  const txnRefRaw = typeof body.txnRef === "string" ? body.txnRef.trim() : undefined;
  const txnRef = txnRefRaw && txnRefRaw.length > 0 ? txnRefRaw.slice(0, 128) : undefined;

  if (!fromMemberId || !toMemberId)
    return jsonResponse({ error: "fromMemberId and toMemberId required" }, { status: 400 });
  if (fromMemberId === toMemberId)
    return jsonResponse({ error: "fromMemberId and toMemberId must differ" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0)
    return jsonResponse({ error: "amount must be a positive number" }, { status: 400 });

  const me = await assertGroupMember(groupId, userId);
  if (!me) return jsonResponse({ error: "Group not found" }, { status: 404 });

  const [fromOk, toOk] = await Promise.all([
    prisma.groupMember.findFirst({ where: { id: fromMemberId, groupId }, select: { id: true } }),
    prisma.groupMember.findFirst({ where: { id: toMemberId, groupId }, select: { id: true } }),
  ]);
  if (!fromOk || !toOk)
    return jsonResponse({ error: "Member is not in this group" }, { status: 400 });

  const raw = await rawDirectDebt(groupId, fromMemberId, toMemberId);
  const prevPayments = await prisma.settlement.aggregate({
    where: { groupId, fromMemberId, toMemberId },
    _sum: { amount: true },
  });
  const reversePayments = await prisma.settlement.aggregate({
    where: { groupId, fromMemberId: toMemberId, toMemberId: fromMemberId },
    _sum: { amount: true },
  });
  const outstanding = raw - (prevPayments._sum.amount ?? 0) + (reversePayments._sum.amount ?? 0);

  if (amount - outstanding > 0.01) {
    return jsonResponse(
      {
        error:
          outstanding <= 0
            ? "Nothing is owed in this direction"
            : `Cannot settle more than is owed (outstanding: ${outstanding.toFixed(2)})`,
      },
      { status: 400 }
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.create({
      data: {
        groupId,
        fromMemberId,
        toMemberId,
        amount,
        note: note?.trim() || null,
        method: method ?? null,
        txnRef: txnRef ?? null,
      },
    });

    const agg = await tx.settlement.aggregate({
      where: { groupId, fromMemberId, toMemberId },
      _sum: { amount: true },
    });
    const totalPaid = agg._sum.amount ?? 0;

    const splits = await tx.billSplit.findMany({
      where: {
        bill: { groupId, memberId: toMemberId },
        memberId: fromMemberId,
        settled: false,
      },
      orderBy: { bill: { date: "asc" } },
      select: { id: true, amount: true },
    });

    let running = 0;
    const idsToSettle: string[] = [];
    for (const s of splits) {
      if (running + s.amount <= totalPaid + 0.01) {
        running += s.amount;
        idsToSettle.push(s.id);
      } else {
        break;
      }
    }
    if (idsToSettle.length > 0) {
      await tx.billSplit.updateMany({
        where: { id: { in: idsToSettle } },
        data: { settled: true },
      });
    }

    return settlement;
  });

  return jsonResponse(
    {
      id: created.id,
      from_member_id: created.fromMemberId,
      to_member_id: created.toMemberId,
      amount: created.amount,
      note: created.note,
      method: created.method,
      txn_ref: created.txnRef,
      date: created.date,
    },
    { status: 201 }
  );
}

// DELETE /api/groups/[id]/settlements?settlementId=...
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { id: groupId } = await params;
  const { searchParams } = new URL(req.url);
  const settlementId = searchParams.get("settlementId");
  if (!settlementId)
    return jsonResponse({ error: "settlementId required" }, { status: 400 });

  const me = await assertGroupMember(groupId, userId);
  if (!me) return jsonResponse({ error: "Group not found" }, { status: 404 });

  const result = await prisma.settlement.deleteMany({
    where: { id: settlementId, groupId },
  });
  if (result.count === 0)
    return jsonResponse({ error: "Settlement not found" }, { status: 404 });
  return jsonResponse({ success: true });
}
