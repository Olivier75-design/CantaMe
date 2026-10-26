import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Baseline hardening: no framing (clickjacking on the pay/unlock buttons),
  // no MIME sniffing, no full URLs (order ids) leaked to third parties.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
