import qrcode from "qrcode-generator";

/** The QR code of `text` as rows of dark (true) and light modules, medium error correction. */
export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** One SVG path for every dark module, in module units (no quiet zone). */
export function qrPath(modules: boolean[][]) {
  let d = "";
  modules.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x} ${y}h1v1h-1z`)));
  return d;
}
