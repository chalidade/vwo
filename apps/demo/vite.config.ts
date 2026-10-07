import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Served from https://chalidade.github.io/vwo/ (GitHub Pages project site).
export default defineConfig({
  base: process.env.DEMO_BASE ?? "/vwo/",
  plugins: [react()],
});
