import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@vwo/db", "@vwo/shared", "@vwo/ui"],
  serverExternalPackages: ["postgres"],
};

export default config;
