// Notification delivery: in-app inbox row + Expo push, in one call.
//
// `notify()` is fire-and-forget from the route's point of view: the actual work
// runs via Next's `after()` once the response has been sent (Vercel keeps the
// function alive with waitUntil). It never throws: a failed push must never
// fail the bill/settlement that triggered it.
//
// Expo's push service fronts FCM (Android) and APNs (iOS) for us, so we only
// ever talk to one HTTP endpoint. Docs: https://docs.expo.dev/push-notifications/sending-notifications/

import { after } from "next/server";
import { prisma } from "@/lib/db";

export type NotificationType =
  | "group_invite"
  | "invite_accepted"
  | "bill_added"
  | "settlement_added"
  | "member_removed";

export interface NotifyMessage {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  groupId?: string | null;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_LIMIT = 100; // Expo rejects requests with >100 messages.

// Human-friendly name for a user row, same fallback the API uses everywhere.
export function nameOf(user: { name: string | null; email: string } | null | undefined): string {
  if (!user) return "Someone";
  return user.name?.trim() || user.email.split("@")[0];
}

// Money in notification text. The user's display currency is a device-side
// preference the server doesn't know, so we show the bare amount.
export function amountText(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Shared by "create group with members" and "invite member".
export function groupInviteMessage(
  inviteeId: string,
  inviterName: string,
  group: { id: string; name: string }
): NotifyMessage {
  return {
    userId: inviteeId,
    type: "group_invite",
    title: "New group invite",
    body: `${inviterName} invited you to "${group.name}". Open Bills to accept.`,
    groupId: group.id,
  };
}

export function notify(messages: NotifyMessage[]): void {
  if (messages.length === 0) return;
  after(() => deliver(messages));
}

async function deliver(messages: NotifyMessage[]): Promise<void> {
  try {
    // Individual creates (not createMany) so we get ids back in message order;
    // the app uses the id to mark the notification read when the push is tapped.
    const rows = await prisma.$transaction(
      messages.map(({ userId, type, title, body, groupId }) =>
        prisma.notification.create({
          data: { userId, type, title, body, groupId: groupId ?? null },
          select: { id: true },
        })
      )
    );
    await sendPush(messages.map((m, i) => ({ ...m, id: rows[i].id })));
  } catch (err) {
    console.error("[notify] delivery failed:", err);
  }
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  channelId: string;
  data: { notificationId: string; type: NotificationType; groupId: string | null };
}

type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

async function sendPush(messages: (NotifyMessage & { id: string })[]): Promise<void> {
  const userIds = [...new Set(messages.map((m) => m.userId))];
  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, token: true },
  });
  if (tokens.length === 0) return;

  const expoMessages: ExpoMessage[] = messages.flatMap((m) =>
    tokens
      .filter((t) => t.userId === m.userId)
      .map((t) => ({
        to: t.token,
        title: m.title,
        body: m.body,
        sound: "default" as const,
        channelId: "default", // must match the channel the app creates
        data: { notificationId: m.id, type: m.type, groupId: m.groupId ?? null },
      }))
  );

  for (let i = 0; i < expoMessages.length; i += EXPO_BATCH_LIMIT) {
    await sendBatch(expoMessages.slice(i, i + EXPO_BATCH_LIMIT));
  }
}

async function sendBatch(batch: ExpoMessage[]): Promise<void> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  // Optional: only needed if "enhanced push security" is enabled on the Expo project.
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  const res = await fetch(EXPO_PUSH_URL, { method: "POST", headers, body: JSON.stringify(batch) });
  if (!res.ok) {
    console.error(`[notify] Expo push failed (${res.status}): ${await res.text()}`);
    return;
  }

  // Tickets come back in the same order as the messages. Prune tokens Expo
  // says are dead (app uninstalled / token rotated) so we stop sending to them.
  const { data } = (await res.json()) as { data: ExpoTicket[] };
  const deadTokens = data
    .map((ticket, i) =>
      ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
        ? batch[i].to
        : null
    )
    .filter((t): t is string => t !== null);

  if (deadTokens.length > 0) {
    await prisma.pushToken.deleteMany({ where: { token: { in: deadTokens } } });
  }
}
