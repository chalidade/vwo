import "server-only";
import { dropPushEndpoint, pushSubscriptionsOf } from "@vwo/db";
import { after } from "next/server";
import webpush from "web-push";
import { db } from "./db";

/**
 * Notifications on the phone or computer outside the app (Web Push). Needs a VAPID key pair in the
 * environment: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (make one with `npx web-push generate-vapid-keys`),
 * and VAPID_SUBJECT, a mailto: or https: contact for the push services. Without them, nothing is sent.
 */
export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;

let ready: boolean | null = null;
function configured() {
  if (ready !== null) return ready;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (ready = false);
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@jobfair.co.id", pub, priv);
    ready = true;
  } catch (e) {
    console.warn("web push keys rejected", (e as Error).message);
    ready = false;
  }
  return ready;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping the notification opens; a path on this site. */
  url?: string;
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string;
}

/** Send to every device of these accounts, after the response has gone. Gone devices are forgotten. */
export function pushTo(userIds: string[], msg: PushMessage) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length || !configured()) return;
  after(async () => {
    try {
      const subs = await pushSubscriptionsOf(db, ids);
      const payload = JSON.stringify({ title: msg.title.slice(0, 80), body: msg.body.slice(0, 180), url: msg.url ?? "/", tag: msg.tag });
      await Promise.all(
        subs.map((s) =>
          webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 3600, urgency: "normal", timeout: 8000 }).catch(async (e: { statusCode?: number }) => {
            if (e.statusCode === 404 || e.statusCode === 410) await dropPushEndpoint(db, s.endpoint);
          }),
        ),
      );
    } catch (e) {
      console.warn("push failed", (e as Error).message);
    }
  });
}
