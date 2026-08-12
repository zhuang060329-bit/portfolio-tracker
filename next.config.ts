import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 全站安全 headers。CSP 不在這裡：它需要每個 request 一組新的 nonce，
  // 所以由 src/proxy.ts 產生，政策本身在 src/lib/csp.ts。
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
