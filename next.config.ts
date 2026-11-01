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

// Статическое демо для GitHub Pages: собираются только файлы *.demo.tsx, сервер не нужен.
const staticDemo: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  devIndicators: false,
  agentRules: false,
  output: "export",
  distDir: "dist-pages",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH,
  pageExtensions: ["demo.tsx", "demo.ts"],
  images: { unoptimized: true },
};

export default process.env.NEXT_PUBLIC_STATIC_DEMO === "1" ? staticDemo : config;
