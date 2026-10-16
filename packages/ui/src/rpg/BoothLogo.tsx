"use client";
// Kept on its own so the home page can show company logos without loading the booth drawings.
import { type CompanyBooth, safeImage } from "@vwo/shared";

/** A company's logo as HTML: its uploaded picture, or the logo letters in its colour. */
export function BoothLogo({ booth, className }: { booth: Pick<CompanyBooth, "logo" | "logoImg" | "color" | "company">; className?: string }) {
  const img = safeImage(booth.logoImg);
  return (
    <span className={className} data-img={img ? "" : undefined} style={{ ["--c" as string]: booth.color }}>
      {img ? <img src={img} alt={`Logo ${booth.company}`} /> : booth.logo}
    </span>
  );
}
