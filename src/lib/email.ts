// Minimal email sender built on Resend's REST API (no SDK dependency).
//
// It's intentionally non-fatal: if RESEND_API_KEY isn't configured we just log
// and return, so the invitation flow keeps working (in-app) even before email
// is set up. Add the key (and optionally EMAIL_FROM / a verified domain) in the
// environment to start actually delivering mail.

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — skipping email to ${to} ("${subject}")`);
    return false;
  }

  // Resend lets you send from onboarding@resend.dev without domain setup (handy
  // for testing); use a verified domain via EMAIL_FROM in production.
  const from = process.env.EMAIL_FROM || "MoneyMate <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) {
      console.error(`[email] send failed (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send threw:", err);
    return false;
  }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://money-mate-eight-smoky.vercel.app";

// Email each invitee (best-effort; a failed email never blocks the invite).
export async function notifyInvitees(inviterName: string | null, groupName: string, emails: string[]) {
  const inviter = inviterName?.trim() || "Someone";
  await Promise.allSettled(
    emails.map((to) => {
      const { subject, html, text } = groupInviteEmail({ inviterName: inviter, groupName, appUrl: APP_URL });
      return sendEmail({ to, subject, html, text });
    })
  );
}

// Pretty HTML + plaintext for a group invitation.
export function groupInviteEmail(opts: {
  inviterName: string;
  groupName: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { inviterName, groupName, appUrl } = opts;
  const subject = `${inviterName} invited you to the group "${groupName}" on MoneyMate`;
  const text =
    `${inviterName} invited you to join the bill-splitting group "${groupName}" on MoneyMate.\n\n` +
    `Open the MoneyMate app and go to Bills → Invitations to accept or decline.\n${appUrl}`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827">
    <h2 style="color:#10b981;margin:0 0 12px">MoneyMate</h2>
    <p style="font-size:15px;line-height:1.5">
      <strong>${escapeHtml(inviterName)}</strong> invited you to join the bill-splitting group
      <strong>"${escapeHtml(groupName)}"</strong>.
    </p>
    <p style="font-size:15px;line-height:1.5">
      Open the MoneyMate app and go to <strong>Bills → Invitations</strong> to accept or decline.
    </p>
    <a href="${appUrl}" style="display:inline-block;margin-top:12px;background:#10b981;color:#fff;
      text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">Open MoneyMate</a>
    <p style="font-size:12px;color:#9ca3af;margin-top:20px">
      If you didn't expect this, you can safely ignore this email.
    </p>
  </div>`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}
