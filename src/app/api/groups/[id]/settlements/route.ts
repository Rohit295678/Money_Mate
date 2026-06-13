import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

async function assertGroupMember(groupId: string, userId: string) {
  return prisma.groupMember.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
}

// Compute the maximum amount that can still be settled in the from→to direction.
//
// This is the "net optimized" debt — the same thing the mobile / web UI shows
// in the Settle Up panel. Mirrors lib/bills-math.ts::calcBalances:
//
//   netForMember = (totalPaid - totalShare)
//                  + receivedSettlements - madeSettlements
//
//   if from is in deficit (netFrom < 0) and to is in surplus (netTo > 0)
//     maxFromTo = min(-netFrom, netTo)
//   else
//     maxFromTo = 0
//
// Why we DON'T just sum unsettled bill_splits in one direction: that ignores
// reverse-direction bills, individually-settled splits, and previously logged
// settlements. The old formula would (incorrectly) refuse legitimate full-net
// settlements once any per-split "Settle this slice" had been clicked.
async function maxAllowedSettlement(
  groupId: string,
  fromMemberId: string,
  toMemberId: string
): Promise<number> {
  // Pull EVERY bill + split for the group in one shot. Cheap; the bill graph
  // for a single group is small (tens of rows).
  const bills = await prisma.bill.findMany({
    where: { groupId },
    select: {
      memberId: true,
      amount: true,
      splits: { select: { memberId: true, amount: true } },
    },
  });

  // Compute net (paid - share) for the two members we care about.
  let netFrom = 0;
  let netTo = 0;
  for (const b of bills) {
    if (b.memberId === fromMemberId) netFrom += b.amount;
    if (b.memberId === toMemberId) netTo += b.amount;
    for (const s of b.splits) {
      if (s.memberId === fromMemberId) netFrom -= s.amount;
      if (s.memberId === toMemberId) netTo -= s.amount;
    }
  }

  // Apply prior settlements as if the debtor had given the creditor money:
  //   from -> to settlement of X: from's net goes UP by X, to's net goes DOWN by X
  //   to   -> from settlement of X: opposite
  const settlements = await prisma.settlement.findMany({
    where: {
      groupId,
      OR: [
        { fromMemberId, toMemberId },
        { fromMemberId: toMemberId, toMemberId: fromMemberId },
      ],
    },
    select: { fromMemberId: true, toMemberId: true, amount: true },
  });
  for (const s of settlements) {
    if (s.fromMemberId === fromMemberId) {
      netFrom += s.amount;
      netTo -= s.amount;
    } else {
      netFrom -= s.amount;
      netTo += s.amount;
    }
  }

  // Round to cents to avoid float drift.
  const fNet = Math.round(netFrom * 100) / 100;
  const tNet = Math.round(netTo * 100) / 100;

  // From owes To only if From is in deficit AND To is in surplus.
  if (fNet >= 0 || tNet <= 0) return 0;
  const max = Math.min(-fNet, tNet);
  return Math.round(max * 100) / 100;
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

  const outstanding = await maxAllowedSettlement(groupId, fromMemberId, toMemberId);

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
