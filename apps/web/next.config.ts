import type { NextConfig } from "next";

// Sent with every response, on Vercel and on our own server alike.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Calls with HR need the microphone and camera on our own pages only.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
