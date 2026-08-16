import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Qai — Creative Business Manager",
    short_name: "Qai",
    description: "Run your business, delight your clients, and grow with one connected workspace.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F2F4F8",
    theme_color: "#7A3F64",
    icons: [
      {
        src: "/icons/qai-icon-192.png?v=20260816",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/qai-icon-512.png?v=20260816",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/qai-maskable-512.png?v=20260816",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/qai-icon-1024.png?v=20260816",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
