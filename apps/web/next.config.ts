import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@vwo/db", "@vwo/shared"],
  serverExternalPackages: ["postgres"],
};

export default config;
