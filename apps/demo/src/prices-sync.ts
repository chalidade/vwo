// The organiser's price list. Live: kept in the server's price table, which only event admins change;
// it comes to everyone with the shared event setup (shared-state.ts). Demo: kept in this browser.
import { cleanPrices, type Prices } from "@vwo/shared";
import { LIVE } from "./mode";
import { fair } from "./useFair";

const KEY = "vwo:prices";
let started = false;

function readLocal(): Prices {
  try {
    return cleanPrices(JSON.parse(localStorage.getItem(KEY) ?? "{}"));
  } catch {
    return {};
  }
}

/** Load the demo's price list once. On the live site the shared setup brings it. Safe to call again. */
export function startPriceSync() {
  if (started) return;
  started = true;
  if (!LIVE) fair.applyPrices(readLocal());
}

/** Save changed prices. Returns an error to show, or null when saved. */
export async function savePrices(changes: Prices): Promise<string | null> {
  const clean = cleanPrices(changes);
  if (!LIVE) {
    const next = { ...readLocal(), ...clean };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Not kept after reload: fine for the demo.
    }
    fair.applyPrices(next);
    return null;
  }
  try {
    const r = await fetch("/api/jobfair/prices", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prices: clean }),
    });
    const d = (await r.json().catch(() => ({}))) as { prices?: unknown; error?: string };
    if (!r.ok) return d.error === "not_allowed" ? "Hanya akun panitia yang bisa mengubah harga." : d.error === "too_many_requests" ? "Terlalu sering menyimpan. Coba lagi beberapa menit lagi." : "Harga gagal disimpan. Coba lagi.";
    fair.applyPrices(cleanPrices(d.prices));
    return null;
  } catch {
    return "Tidak tersambung ke server. Periksa internet lalu coba lagi.";
  }
}
