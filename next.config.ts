import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  turbopack: { root: import.meta.dirname },
};

export default config;
