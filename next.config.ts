import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 全站安全 headers。CSP 未列入：Next inline script（theme init）與 Recharts
  // 需要 nonce 佈線才能上嚴格 CSP，留待獨立 task。
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
