import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Qai Space | Qai",
  description: "Your public home for services, portfolio, and bookings.",
};

export default function SpaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
