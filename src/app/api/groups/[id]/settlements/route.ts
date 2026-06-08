import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function assertGroupMember(groupId: string, userId: string) {
  return prisma.groupMember.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
}

// Compute (from -> to) RAW direct debt for this pair, ignoring already-logged
// settlements. This is: sum of unsettled bill_splits where `from` is the
// debtor and `to` was the payer.
//
// We use this purely for overpay-prevention and the "auto-mark splits as
// settled" pass — NOT for what the UI displays (the UI already gets full
// data via /api/groups and computes optimal balances client-side).
async function rawDirectDebt(
  groupId: string,
  fromMemberId: string,
  toMemberId: string
): Promise<number> {
  // Splits where `to` paid and `from` is the debtor row
  const debtorSplits = await prisma.billSplit.findMany({
    where: {
      bill: { groupId, memberId: toMemberId },
      memberId: fromMemberId,
      settled: false,
    },
    select: { amount: true },
  });
  const debtSum = debtorSplits.reduce((s, x) => s + x.amount, 0);

  // Splits in the other direction (from paid, to is debtor) — net out
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

// POST /api/groups/[id]/settlements
// body: { fromMemberId, toMemberId, amount, note? }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const body = await req.json();
  const fromMemberId: string | undefined = body.fromMemberId;
  const toMemberId: string | undefined = body.toMemberId;
  const note: string | undefined = body.note;
  const amount = Number(body.amount);

  if (!fromMemberId || !toMemberId)
    return NextResponse.json({ error: "fromMemberId and toMemberId required" }, { status: 400 });
  if (fromMemberId === toMemberId)
    return NextResponse.json({ error: "fromMemberId and toMemberId must differ" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0)
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });

  // Auth: requester must be a group member.
  const me = await assertGroupMember(groupId, session.user.id);
  if (!me) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  // Both endpoints must belong to this group.
  const [fromOk, toOk] = await Promise.all([
    prisma.groupMember.findFirst({ where: { id: fromMemberId, groupId }, select: { id: true } }),
    prisma.groupMember.findFirst({ where: { id: toMemberId, groupId }, select: { id: true } }),
  ]);
  if (!fromOk || !toOk)
    return NextResponse.json({ error: "Member is not in this group" }, { status: 400 });

  // Compute current outstanding (raw direct debt − payments already logged for this pair).
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

  // Block overpay (per spec). Allow tiny float slack.
  if (amount - outstanding > 0.01) {
    return NextResponse.json(
      {
        error:
          outstanding <= 0
            ? "Nothing is owed in this direction"
            : `Cannot settle more than is owed (outstanding: ${outstanding.toFixed(2)})`,
      },
      { status: 400 }
    );
  }

  // Insert settlement and (best-effort) auto-mark direct splits as settled
  // when their cumulative amount has been covered. Walk oldest splits first.
  const created = await prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.create({
      data: {
        groupId,
        fromMemberId,
        toMemberId,
        amount,
        note: note?.trim() || null,
      },
    });

    // Total payments now covering this direction.
    const agg = await tx.settlement.aggregate({
      where: { groupId, fromMemberId, toMemberId },
      _sum: { amount: true },
    });
    const totalPaid = agg._sum.amount ?? 0;

    // Direct splits where `to` paid the bill and `from` owes a share.
    // Walk oldest-first; mark settled while running total <= totalPaid.
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

  return NextResponse.json(
    {
      id: created.id,
      from_member_id: created.fromMemberId,
      to_member_id: created.toMemberId,
      amount: created.amount,
      note: created.note,
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const { searchParams } = new URL(req.url);
  const settlementId = searchParams.get("settlementId");
  if (!settlementId)
    return NextResponse.json({ error: "settlementId required" }, { status: 400 });

  const me = await assertGroupMember(groupId, session.user.id);
  if (!me) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const result = await prisma.settlement.deleteMany({
    where: { id: settlementId, groupId },
  });
  if (result.count === 0)
    return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
