"use client";

import { useCallback, useMemo, useState } from "react";

import { BookingFormValues } from "@/features/booking/schema";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { useServices } from "@/features/service/hooks/useServices";
import { calendarRepository } from "../api/calendarRepository";
import { CalendarBooking, CalendarView } from "../types";

const DEFAULT_BOOKING_VALUES: BookingFormValues = {
  customerId: "",
  serviceId: "",
  bookingDate: "",
  startTime: "",
  endTime: "",
  location: "",
  servicePrice: 0,
  bookingStatus: "Scheduled",
  fullPaymentDueDate: "",
  notes: "",
};

export function useCalendar() {
  const bookingData = useBookings();
  const customerData = useCustomers();
  const serviceData = useServices();
  const { bookings, createBooking, updateBooking, deleteBooking } = bookingData;
  const { customers } = customerData;
  const { services } = serviceData;

  const [view, setView] = useState<CalendarView>(calendarRepository.getDefaultView());
  const [activeDate, setActiveDate] = useState<Date>(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);
  const [initialBookingValues, setInitialBookingValues] = useState<BookingFormValues | undefined>();

  const bookingsWithNames = useMemo<CalendarBooking[]>(
    () =>
      bookings.map((booking) => {
        const customer = customers.find((customer) => customer.id === booking.customerId);
        const service = services.find((service) => service.id === booking.serviceId);

        return {
          ...booking,
          customerName: customer?.name ?? "Unknown Customer",
          serviceName: service?.name ?? "Unknown Service",
        };
      }),
    [bookings, customers, services],
  );

  const goPrevious = useCallback(() => {
    setActiveDate((current) => {
      const nextDate = new Date(current);
      if (view === "month") {
        nextDate.setMonth(nextDate.getMonth() - 1);
      } else if (view === "week") {
        nextDate.setDate(nextDate.getDate() - 7);
      } else {
        nextDate.setDate(nextDate.getDate() - 1);
      }
      return nextDate;
    });
  }, [view]);

  const goNext = useCallback(() => {
    setActiveDate((current) => {
      const nextDate = new Date(current);
      if (view === "month") {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (view === "week") {
        nextDate.setDate(nextDate.getDate() + 7);
      } else {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      return nextDate;
    });
  }, [view]);

  const goToday = useCallback(() => {
    setActiveDate(new Date());
  }, []);

  const openCreateForDate = useCallback((date: string) => {
    setSelectedBooking(null);
    setInitialBookingValues({ ...DEFAULT_BOOKING_VALUES, bookingDate: date, fullPaymentDueDate: date });
    setDialogOpen(true);
  }, []);

  const openEditBooking = useCallback((booking: CalendarBooking) => {
    setSelectedBooking(booking);
    setInitialBookingValues(undefined);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedBooking(null);
    setInitialBookingValues(undefined);
  }, []);

  return {
    view,
    setView,
    activeDate,
    bookingsWithNames,
    customers,
    services,
    selectedBooking,
    initialBookingValues,
    dialogOpen,
    goPrevious,
    goNext,
    goToday,
    openCreateForDate,
    openEditBooking,
    closeDialog,
    createBooking,
    updateBooking,
    deleteBooking,
    isLoading: bookingData.isLoading || customerData.isLoading || serviceData.isLoading,
    loadError: bookingData.loadError || customerData.loadError || serviceData.loadError,
    retry: () => {
      bookingData.retry();
      customerData.retry();
      serviceData.retry();
    },
  };
}
