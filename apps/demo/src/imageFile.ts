// Reading a picked image file into a small square JPEG, for profile photos and company logos.
// The file is redrawn on a canvas, so whatever was in it (metadata, scripts in an SVG) is left behind.

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_UPLOAD = 8 * 1024 * 1024;

export async function readImageFile(file: File, size = 160, opts: { square?: boolean; background?: string } = {}): Promise<string> {
  if (!TYPES.includes(file.type)) throw new Error("Pilih gambar PNG, JPG, WebP, atau GIF.");
  if (file.size > MAX_UPLOAD) throw new Error("Gambar terlalu besar, maksimal 8 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Gambar tidak bisa dibaca."));
      i.src = url;
    });
    const square = opts.square ?? true;
    const scale = square ? size / Math.min(img.width, img.height) : size / Math.max(img.width, img.height);
    const w = square ? size : Math.max(1, Math.round(img.width * scale));
    const h = square ? size : Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Browser ini tidak bisa memproses gambar.");
    ctx.fillStyle = opts.background ?? "#ffffff";
    ctx.fillRect(0, 0, w, h);
    // Square crops keep the middle of the picture.
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
