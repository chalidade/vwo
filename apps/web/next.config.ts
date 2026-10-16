import type { NextConfig } from "next";

const BASE_CSP = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'";

// Realtime (player positions, calls, the stage) talks to Supabase. The project's own address when the
// build knows it, otherwise any Supabase project.
const supabase = (() => {
  try {
    const u = new URL(process.env.VITE_SUPABASE_URL ?? "");
    return `https://${u.host} wss://${u.host}`;
  } catch {
    return "https://*.supabase.co wss://*.supabase.co";
  }
})();

// The game is a static bundle with no inline script: only our own files (and Turnstile, when the sign-up
// form uses it) may run, so a link or name that slipped through as HTML can't run script. Everything else
// it loads is listed: fonts, company pictures and videos (any https address), YouTube and Vimeo players,
// and realtime. Inline styles stay allowed: React sets positions with style attributes.
const PLAY_CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  `connect-src 'self' data: blob: https://challenges.cloudflare.com ${supabase}`,
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://vimeo.com https://challenges.cloudflare.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  BASE_CSP,
].join("; ");

// The server-rendered pages (sign-up, organiser hub, venue pages). Next.js puts its start-up data in
// inline scripts, so those stay allowed; scripts from anywhere else don't run. Development needs eval
// for hot reload. The venue pages talk to the Socket.IO server (NEXT_PUBLIC_REALTIME_URL).
const realtime = (() => {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_REALTIME_URL ?? "");
    return `${u.origin} ${u.origin.replace(/^http/, "ws")}`;
  } catch {
    return "";
  }
})();
const WEB_CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' https://challenges.cloudflare.com ${realtime}`.trim(),
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  BASE_CSP,
].join("; ");

// Sent with every response, on Vercel and on our own server alike.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Calls with HR need the microphone and camera on our own pages only.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: WEB_CSP },
];

const config: NextConfig = {
  transpilePackages: ["@vwo/db", "@vwo/shared", "@vwo/ui"],
  serverExternalPackages: ["postgres"],
  poweredByHeader: false,
  // The game lives in public/play as a static app; its service worker needs the trailing slash.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/play", destination: "/play/index.html" },
      { source: "/play/", destination: "/play/index.html" },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...["/play", "/play/:path*"].map((source) => ({ source, headers: [{ key: "Content-Security-Policy", value: PLAY_CSP }] })),
      // Built files carry a hash of their content in the name, so a browser may keep them for good.
      { source: "/play/assets/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default config;
