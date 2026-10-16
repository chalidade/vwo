import { type CompanyBooth, openJobs } from "@vwo/shared";
import { MASCOT_KINDS, mascotFor } from "@vwo/ui";

/** What a booth's decorations show when nobody filled them in yet, made from the booth's profile. */
export function mediaOf(b: CompanyBooth) {
  const m = b.media ?? {};
  const mascot = m.mascot && MASCOT_KINDS.some((k) => k.id === m.mascot) ? m.mascot : mascotFor(b.id);
  return {
    mascot,
    mascotName: m.mascotName?.trim() || MASCOT_KINDS.find((k) => k.id === mascot)!.name,
    videoUrl: m.videoUrl?.trim() || "",
    brochure: m.brochure?.length
      ? m.brochure
      : [
          { title: `Kenalan dengan ${b.company}`, text: b.about },
          { title: "Kenapa kerja di sini", text: (b.benefits ?? [b.tagline]).join(" · ") },
          {
            title: "Posisi yang dibuka",
            text:
              openJobs(b)
                .map((j) => `${j.title} (${j.type}, ${j.location})`)
                .join(" · ") || "Pantau terus, lowongan baru segera dibuka.",
          },
        ],
    mascotLine: m.mascotLine?.trim() || `Hai! Aku maskot ${b.company}. Ambil brosur kami dan lamar sekarang ya!`,
    merch: m.merch ?? { name: `Tote bag ${b.company}`, stock: 50 },
    coffee: m.coffee?.trim() || "Es kopi susu gratis",
    hashtag: m.hashtag?.trim() || `#Kerja${b.company.replace(/\W+/g, "")}`,
    stories: m.stories?.length
      ? m.stories
      : [
          { name: b.recruiter, role: "Recruiter", text: `Di ${b.company} kami percaya orang baru membawa ide baru. Banyak tim kami berawal dari job fair seperti ini.` },
          { name: "Karyawan", role: "Angkatan 2024", text: `${b.tagline}. Mentor saya sabar sekali di tiga bulan pertama, jadi cepat belajar.` },
        ],
  };
}
