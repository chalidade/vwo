import type { PeerInfo } from "./call";

/** One line on how the connection to the speaker is going, so a stuck stream says why. */
export function linkText(i: (PeerInfo & { tries?: number }) | null) {
  if (!i || i.state === "waiting" || i.state === "new") return i?.tries && i.tries > 1 ? `Menghubungi pembicara lagi (percobaan ${i.tries})…` : "Menghubungi pembicara…";
  if (i.state === "connecting") return "Menyambungkan…";
  if (i.state === "connected") return i.route === "relay" ? "Tersambung lewat server relay" : "Tersambung langsung";
  if (i.state === "disconnected") return "Sambungan terputus, menyambung ulang…";
  if (i.state === "failed") return "Gagal tersambung, mencoba lagi…";
  return "Siaran ditutup";
}
