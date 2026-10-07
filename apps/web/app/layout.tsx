import "@vwo/ui/src/rpg/rpg.css";
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "VWO Virtual Cafe" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
