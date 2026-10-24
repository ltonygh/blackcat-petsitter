/**
 * Minimal transactional email helper (Resend HTTP API).
 *
 * We call Resend's REST API directly with `fetch` rather than adding the
 * `resend` npm dependency, so this module has no extra install/edge-runtime
 * concerns.
 *
 * Sending is BEST-EFFORT and NON-BLOCKING: the booking flow must never fail
 * because email delivery failed. Callers should treat a rejection as a logged
 * warning, and this module also swallows/logs its own errors.
 *
 * Configuration (all optional — if missing, sends are skipped):
 *   RESEND_API_KEY      Resend API key.
 *   RESEND_FROM_EMAIL   Verified sender, e.g. "Blackcat <hello@blackcat.app>".
 *   NEXTAUTH_URL/AUTH_URL  Base URL used to build the magic link.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function appBaseUrl(): string {
  const base =
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";
  return base.replace(/\/$/, "");
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  // Not configured — skip silently (email is optional).
  if (!apiKey || !from) return false;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
      // Don't let a slow mail API stall the caller.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(
        `[email] Resend responded ${res.status} for ${params.to}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      `[email] Failed to send to ${params.to}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/**
 * Send a guest "your booking is created — sign in to manage it" email with a
 * link to the login page (which then routes the guest to their dashboard once
 * they authenticate with this email via Google).
 *
 * Never throws. Returns true if the message was accepted by Resend.
 */
export async function sendGuestBookingMagicLink(params: {
  to: string;
  guestName: string;
  serviceType: string;
}): Promise<boolean> {
  const loginUrl = `${appBaseUrl()}/login`;
  const subject = "Your Blackcat.petsitter booking is confirmed";
  const text = [
    `Hi ${params.guestName},`,
    "",
    `We've received your ${params.serviceType} booking request.`,
    "Sign in to view your booking and upload your pet's documents:",
    loginUrl,
    "",
    "See you soon!",
    "Blackcat.petsitter",
  ].join("\n");
  const html = `
    <div style="font-family:sans-serif;line-height:1.5">
      <p>Hi ${escapeHtml(params.guestName)},</p>
      <p>We've received your <strong>${escapeHtml(
        params.serviceType,
      )}</strong> booking request.</p>
      <p>Sign in to view your booking and upload your pet's documents:</p>
      <p><a href="${loginUrl}">${loginUrl}</a></p>
      <p>See you soon!<br/>Blackcat.petsitter</p>
    </div>`.trim();

  return sendEmail({ to: params.to, subject, html, text });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
