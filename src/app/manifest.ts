import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Qai — Creative Business Manager",
    short_name: "Qai",
    description: "Manage bookings, customers, payments, and expenses in one place.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F5F7F6",
    theme_color: "#0D5C5A",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/qai-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/qai-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/qai-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
