import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function QuickActions() {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">Quick Actions</h3>
      <div className="mt-4 flex flex-col gap-3">
        <Link href="/bookings">
          <Button className="w-full">Add Booking</Button>
        </Link>
        <Link href="/customers">
          <Button className="w-full" variant="outline">Add Customer</Button>
        </Link>
        <Link href="/services">
          <Button className="w-full" variant="outline">Add Service</Button>
        </Link>
      </div>
    </div>
  );
}
