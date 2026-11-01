import type { NextConfig } from "next";

// Сайт показывает данные детей, поэтому закрываем его от индексации и встраивания.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noimageindex" },
];

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  poweredByHeader: false,
  devIndicators: false,
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
