import { describe, expect, it } from "vitest";

import { defaultQaiPage } from "./validation";
import { cloudBookingsForCapacity, materializeCloudPage } from "./cloudMapping";

describe("cloud Qai Space mapping", () => {
  it("takes operational Service truth while preserving page presentation", () => {
    const page = defaultQaiPage();
    page.services = [{
      serviceId: "service-1", visible: true, title: "Public portrait name", titleSource: "Custom",
      description: "Old", price: 123, priceSource: "Service", priceMode: "Starting from",
      actionMode: "Booking request", durationMinutes: 10, defaultSessionCount: 1,
      locationPolicy: "Client can choose", optionGroups: [], variants: [], position: 0, featured: true,
    }];
    const result = materializeCloudPage(page, [{
      id: "service-1", name: "Portrait", category_id: "category-1", price: 500_000,
      duration_minutes: 90, default_session_count: 2, location_policy: "Business/studio only",
      description: "Live description", active: true, option_groups: [], variants: [], availability: { mode: "Flexible" },
    }]);
    expect(result.services).toMatchObject([{
      serviceId: "service-1", title: "Public portrait name", price: 500_000,
      durationMinutes: 90, defaultSessionCount: 2, description: "Live description",
      visible: true, featured: true,
    }]);
  });

  it("keeps newly created Services hidden until the owner publishes them", () => {
    const result = materializeCloudPage(defaultQaiPage(), [{
      id: "service-2", name: "Consultation", category_id: "category-1", price: 0,
      duration_minutes: 60, default_session_count: 1, description: "", active: true,
    }]);
    expect(result.services[0]).toMatchObject({ serviceId: "service-2", visible: false, price: 0 });
  });

  it("removes inactive and deleted operational Services from the public page", () => {
    const page = defaultQaiPage();
    page.services = [
      {
        serviceId: "inactive-service", visible: true, title: "Inactive", description: "", price: 100_000,
        priceMode: "Fixed price", actionMode: "Booking request", durationMinutes: 60, defaultSessionCount: 1,
        locationPolicy: "Client can choose", optionGroups: [], variants: [], position: 0, featured: false,
      },
      {
        serviceId: "deleted-service", visible: true, title: "Deleted", description: "", price: 200_000,
        priceMode: "Fixed price", actionMode: "Booking request", durationMinutes: 60, defaultSessionCount: 1,
        locationPolicy: "Client can choose", optionGroups: [], variants: [], position: 1, featured: false,
      },
    ];

    const result = materializeCloudPage(page, [{
      id: "inactive-service", name: "Inactive", category_id: "category-1", price: 100_000,
      duration_minutes: 60, default_session_count: 1, description: "", active: false,
    }]);

    expect(result.services).toEqual([]);
  });

  it("maps stable booking snapshots and capacity keys without live-price fallback", () => {
    const bookings = cloudBookingsForCapacity([{
      id: "booking-1", customer_id: "customer-1", service_id: "service-1", service_price: 0,
      service_snapshot: { serviceName: "Historical service", price: 50_000 },
      capacity_source_request_id: "request-1", capacity_slot_keys: ["service-1|2026-08-31T10:00"],
      booking_status: "Scheduled", full_payment_due_date: "2026-09-01", notes: "",
      created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z",
    }], [{
      id: "session-1", booking_id: "booking-1", sequence: 1,
      start_at: "2026-08-31T03:00:00.000Z", end_at: "2026-08-31T04:00:00.000Z",
      label: "", location: "Online", notes: "", created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z",
    }]);
    expect(bookings[0]).toMatchObject({ servicePrice: 0, capacitySourceRequestId: "request-1", capacitySlotKeys: ["service-1|2026-08-31T10:00"] });
    expect(bookings[0].sessions).toHaveLength(1);
  });
});
