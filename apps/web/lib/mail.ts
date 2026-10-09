import "server-only";

/** Where links in emails point, for example https://vwo.example. */
export const appUrl = () =>
  (process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, "");

/**
 * Send a transactional email through Resend when RESEND_API_KEY is set. Without it (local
 * development) the message is printed to the server log instead, so links can still be clicked.
 */
export async function sendMail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") console.warn(`[mail] RESEND_API_KEY is not set; not sent: ${subject}`);
    else console.log(`[mail] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM ?? "jobfair <noreply@vwo.example>", to, subject, text }),
  });
  if (!res.ok) throw new Error(`mail failed: ${res.status}`);
}
