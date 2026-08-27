import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/qai-page",
        has: [{ type: "query", key: "tab", value: "Page" }],
        destination: "/space?tab=Profile",
        permanent: true,
      },
      {
        source: "/qai-page",
        destination: "/space",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
