// Notifications on the phone outside the app (Web Push), live site only: HR's replies and
// invitations, new applications for companies, friend requests. The browser asks permission once.
import { useEffect, useState } from "react";
import { LIVE } from "../mode";

export type PushState = "unsupported" | "install" | "off" | "denied" | "available" | "on" | "busy";

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

let publicKey: Promise<string | null> | null = null;
const serverKey = () =>
  (publicKey ??= fetch("/api/push", { credentials: "same-origin" })
    .then((r) => (r.ok ? (r.json() as Promise<{ publicKey?: string | null }>) : null))
    .then((d) => d?.publicKey ?? null)
    .catch(() => null));

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const registration = () => navigator.serviceWorker.getRegistration().then((r) => r ?? navigator.serviceWorker.ready);

async function currentState(): Promise<PushState> {
  if (!LIVE) return "unsupported";
  // iPhone only allows web notifications for a site added to the home screen.
  if (ios() && !standalone()) return supported() || "Notification" in window ? "install" : "install";
  if (!supported()) return "unsupported";
  if (!(await serverKey())) return "off";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "available";
}

/** Ask permission and subscribe this device. */
export async function enablePush(): Promise<PushState> {
  const key = await serverKey();
  if (!key) return "off";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "available";
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  const r = await fetch("/api/push", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  return r.ok ? "on" : "available";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push", { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
    await sub.unsubscribe().catch(() => false);
  }
  return "available";
}

export function usePush() {
  const [state, setState] = useState<PushState>("busy");
  useEffect(() => {
    let gone = false;
    void currentState().then((s) => !gone && setState(s));
    return () => {
      gone = true;
    };
  }, []);
  const run = (fn: () => Promise<PushState>) => {
    setState("busy");
    void fn()
      .catch(() => "available" as const)
      .then(setState);
  };
  return { state, enable: () => run(enablePush), disable: () => run(disablePush) };
}
