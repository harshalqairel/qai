import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Qai — Creative Business Manager",
    short_name: "Qai",
    description: "Manage bookings, customers, payments, and expenses in one place.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F2F4F8",
    theme_color: "#4F6BFF",
    icons: [
      {
        src: "/icons/qai-icon-192.png?v=20260814",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/qai-icon-512.png?v=20260814",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/qai-maskable-512.png?v=20260814",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/qai-icon-1024.png?v=20260814",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
