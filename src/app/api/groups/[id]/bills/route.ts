import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";

type RawMember = {
  id: string;
  groupId: string;
  userId: string;
  user: { id: string; name: string | null; email: string };
};

type RawSplit = {
  id: string;
  billId: string;
  memberId: string;
  amount: number;
  settled: boolean;
  member: RawMember;
};

type RawBill = {
  id: string;
  groupId: string;
  memberId: string;
  title: string;
  amount: number;
  date: Date;
  paidBy: RawMember;
  splits: RawSplit[];
};

function flattenMember(m: RawMember) {
  return {
    id: m.id,
    user_id: m.userId,
    name: m.user.name ?? m.user.email.split("@")[0],
    email: m.user.email,
  };
}

function flattenBill(b: RawBill) {
  return {
    id: b.id,
    group_id: b.groupId,
    member_id: b.memberId,
    title: b.title,
    amount: b.amount,
    date: b.date,
    paidBy: flattenMember(b.paidBy),
    splits: b.splits.map((s) => ({
      id: s.id,
      bill_id: s.billId,
      member_id: s.memberId,
      amount: s.amount,
      settled: s.settled,
      member: flattenMember(s.member),
    })),
  };
}

async function assertGroupMember(groupId: string, userId: string) {
  return prisma.groupMember.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { id: groupId } = await params;
  const body = await req.json();
  const title: string | undefined = body.title;
  const amount: number | string | undefined = body.amount;
  const memberId: string | undefined = body.memberId;
  // Optional: if provided, splits the bill exactly as given.
  // Shape: [{ memberId: string, amount: number }, ...]
  const customSplits: Array<{ memberId: string; amount: number | string }> | undefined =
    Array.isArray(body.splits) ? body.splits : undefined;

  if (!title?.trim() || amount === undefined || amount === null || !memberId)
    return jsonResponse({ error: "title, amount, memberId required" }, { status: 400 });

  const total = Number(amount);
  if (!Number.isFinite(total) || total <= 0)
    return jsonResponse({ error: "amount must be a positive number" }, { status: 400 });

  // Auth: requester must belong to the group.
  const me = await assertGroupMember(groupId, userId);
  if (!me) return jsonResponse({ error: "Group not found" }, { status: 404 });

  // memberId (the payer) must also belong to this group.
  const payer = await prisma.groupMember.findFirst({
    where: { id: memberId, groupId },
    select: { id: true },
  });
  if (!payer)
    return jsonResponse({ error: "Payer is not in this group" }, { status: 400 });

  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId },
    select: { id: true },
  });
  if (groupMembers.length === 0)
    return jsonResponse({ error: "Group has no members" }, { status: 400 });

  // Build the final list of splits. Either custom (validated) or equal among everyone.
  let splitsToCreate: Array<{ memberId: string; amount: number; settled: boolean }>;

  if (customSplits && customSplits.length > 0) {
    const groupMemberIds = new Set(groupMembers.map((m) => m.id));
    const seen = new Set<string>();
    const normalized: Array<{ memberId: string; amount: number }> = [];
    for (const s of customSplits) {
      if (typeof s.memberId !== "string" || !groupMemberIds.has(s.memberId))
        return jsonResponse(
          { error: "splits contain a memberId that's not in this group" },
          { status: 400 }
        );
      if (seen.has(s.memberId))
        return jsonResponse(
          { error: "splits contain duplicate memberId" },
          { status: 400 }
        );
      seen.add(s.memberId);
      const amt = Number(s.amount);
      if (!Number.isFinite(amt) || amt < 0)
        return jsonResponse(
          { error: "split amounts must be non-negative numbers" },
          { status: 400 }
        );
      normalized.push({ memberId: s.memberId, amount: amt });
    }

    // Payer must be included in the split (per product rule: payer auto-included).
    if (!seen.has(memberId))
      return jsonResponse(
        { error: "Payer must be included in the split" },
        { status: 400 }
      );

    // Sum must match total within a small tolerance (handles float rounding).
    const sum = normalized.reduce((a, b) => a + b.amount, 0);
    if (Math.abs(sum - total) > 0.01)
      return jsonResponse(
        { error: `Split amounts (${sum.toFixed(2)}) do not sum to total (${total.toFixed(2)})` },
        { status: 400 }
      );

    splitsToCreate = normalized.map((s) => ({
      memberId: s.memberId,
      amount: s.amount,
      settled: s.memberId === memberId,
    }));
  } else {
    const perPerson = total / groupMembers.length;
    splitsToCreate = groupMembers.map((m) => ({
      memberId: m.id,
      amount: perPerson,
      settled: m.id === memberId,
    }));
  }

  const bill = await prisma.bill.create({
    data: {
      groupId,
      memberId,
      title: title.trim(),
      amount: total,
      splits: { create: splitsToCreate },
    },
    include: {
      paidBy: { include: { user: { select: { id: true, name: true, email: true } } } },
      splits: {
        include: {
          member: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
    },
  });

  return jsonResponse(flattenBill(bill as unknown as RawBill), { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { id: groupId } = await params;
  const { splitId } = await req.json();

  const me = await assertGroupMember(groupId, userId);
  if (!me) return jsonResponse({ error: "Group not found" }, { status: 404 });

  const split = await prisma.billSplit.findFirst({
    where: { id: splitId, bill: { groupId } },
    select: { id: true },
  });
  if (!split) return jsonResponse({ error: "Not found" }, { status: 404 });

  await prisma.billSplit.update({ where: { id: splitId }, data: { settled: true } });
  return jsonResponse({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const { id: groupId } = await params;
  const { searchParams } = new URL(req.url);
  const billId = searchParams.get("billId");
  if (!billId) return jsonResponse({ error: "billId required" }, { status: 400 });

  const me = await assertGroupMember(groupId, userId);
  if (!me) return jsonResponse({ error: "Group not found" }, { status: 404 });

  const result = await prisma.bill.deleteMany({ where: { id: billId, groupId } });
  if (result.count === 0)
    return jsonResponse({ error: "Bill not found" }, { status: 404 });
  return jsonResponse({ success: true });
}
