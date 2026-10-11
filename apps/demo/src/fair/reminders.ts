// While the game is open: an alert an hour and ten minutes before the player's interview, office
// visit or an Aula item they asked to be reminded of. A phone notification when the browser allows
// it, and always a toast in the game. The morning email and push come from the server.
import { alertsDue, wibClock } from "@vwo/shared";
import { useEffect } from "react";
import { fair } from "../useFair";

const SHOWN_KEY = "vwo:reminders-shown";
const CHECK_MS = 30_000;

function loadShown(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function saveShown(shown: Set<string>) {
  try {
    // Only the newest are worth keeping: an alert is for one event at one time.
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...shown].slice(-60)));
  } catch {
    // Storage blocked: at worst an alert shows again after a reload.
  }
}

/** A notification outside the page, through the service worker (phones only allow it there). */
async function notify(title: string, body: string, tag: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: "./icons/icon-192.png", data: { url: "/play/" } });
    else new Notification(title, { body, tag });
  } catch {
    // Not allowed here after all: the toast still shows.
  }
}

/** Check every half minute (and when the tab comes back) for alerts that are due. */
export function useReminderAlerts(enabled: boolean, toast: (text: string) => void) {
  useEffect(() => {
    if (!enabled) return;
    const shown = loadShown();
    const check = () => {
      const due = alertsDue(fair.myReminders(), Date.now(), shown);
      if (!due.length) return;
      for (const { reminder: r, mark, minutes } of due) {
        shown.add(mark);
        const soon = minutes >= 50 ? "1 jam lagi" : `${minutes} menit lagi`;
        const title = `⏰ ${soon}: ${r.title}`;
        const body = `Jam ${wibClock(r.at)} WIB${r.where ? ` · ${r.where}` : ""}`;
        void notify(title, body, mark);
        toast(`⏰ ${soon} (${wibClock(r.at)}): ${r.title}`);
      }
      navigator.vibrate?.([200, 100, 200]);
      saveShown(shown);
    };
    check();
    const timer = window.setInterval(check, CHECK_MS);
    const back = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", back);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", back);
    };
  }, [enabled, toast]);
}
