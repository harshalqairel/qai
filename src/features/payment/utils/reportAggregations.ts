import { Booking } from "@/features/booking/types";
import { Customer } from "@/features/customer/types";
import { Service } from "@/features/service/types";
import { Payment } from "../types";
import { summarizeBookingPayments } from "./paymentCalculations";

export function getMonthlyRealizedRevenue(payments: Payment[], year: number): number[] {
  const monthly = Array.from({ length: 12 }, () => 0);

  for (const payment of payments) {
    const d = new Date(`${payment.date}T00:00:00`);
    if (d.getFullYear() !== year) continue;
    monthly[d.getMonth()] += payment.amount;
  }

  return monthly;
}

export function getOutstandingBookings(bookings: Booking[], payments: Payment[]): Booking[] {
  const summaries = summarizeBookingPayments(bookings, payments);
  return bookings.filter((booking) => {
    if (booking.bookingStatus === "Cancelled") return false;
    const summary = summaries[booking.id];
    return summary ? summary.remainingAmount > 0 : booking.servicePrice > 0;
  });
}

export function getRevenueByService(bookings: Booking[], services: Service[], payments: Payment[]) {
  const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));
  const revenueByService = new Map<string, number>();

  for (const payment of payments) {
    const booking = bookingMap.get(payment.bookingId);
    if (!booking || booking.bookingStatus === "Cancelled") continue;
    revenueByService.set(booking.serviceId, (revenueByService.get(booking.serviceId) ?? 0) + payment.amount);
  }

  return services.map((service) => ({
    serviceId: service.id,
    serviceName: service.name,
    revenue: revenueByService.get(service.id) ?? 0,
  }));
}

export function getRevenueByCustomer(bookings: Booking[], customers: Customer[], payments: Payment[]) {
  const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));
  const revenueByCustomer = new Map<string, number>();

  for (const payment of payments) {
    const booking = bookingMap.get(payment.bookingId);
    if (!booking || booking.bookingStatus === "Cancelled") continue;
    revenueByCustomer.set(booking.customerId, (revenueByCustomer.get(booking.customerId) ?? 0) + payment.amount);
  }

  return customers.map((customer) => ({
    customerId: customer.id,
    customerName: customer.name,
    revenue: revenueByCustomer.get(customer.id) ?? 0,
  }));
}

export function getRevenueByPaymentMethod(payments: Payment[]) {
  const byMethod = new Map<string, number>();

  for (const payment of payments) {
    byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + payment.amount);
  }

  return Array.from(byMethod.entries()).map(([method, revenue]) => ({ method, revenue }));
}
