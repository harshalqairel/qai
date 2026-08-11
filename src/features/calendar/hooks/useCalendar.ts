"use client";

import { useCallback, useMemo, useState } from "react";

import { BookingFormValues } from "@/features/booking/schema";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { useServices } from "@/features/service/hooks/useServices";
import { calendarRepository } from "../api/calendarRepository";
import { CalendarBooking, CalendarView } from "../types";
import { instantParts } from "@/features/booking/utils/bookingSessions";
import { useServiceCategories } from "@/features/service-category/hooks/useServiceCategories";
import { calendarDateFromKey, shiftMonthClamped } from "../calendarUtils";

const DEFAULT_BOOKING_VALUES: BookingFormValues = {
  customerId: "",
  serviceId: "",
  sessions: [{ label: "", date: "", startTime: "", endTime: "", location: "", notes: "" }],
  servicePrice: 0,
  bookingStatus: "Scheduled",
  fullPaymentDueDate: "",
  notes: "",
};

export function useCalendar() {
  const bookingData = useBookings();
  const customerData = useCustomers();
  const serviceData = useServices();
  const serviceCategoryData = useServiceCategories();
  const { bookings, createBooking, updateBooking, deleteBooking } = bookingData;
  const { customers } = customerData;
  const { services } = serviceData;
  const { categories: serviceCategories } = serviceCategoryData;

  const [view, setView] = useState<CalendarView>(calendarRepository.getDefaultView());
  const todayKey = instantParts(new Date().toISOString(), bookingData.timezone).date;
  const [activeDate, setActiveDate] = useState<Date>(() => calendarDateFromKey(todayKey));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);
  const [initialBookingValues, setInitialBookingValues] = useState<BookingFormValues | undefined>();

  const bookingsWithNames = useMemo<CalendarBooking[]>(
    () =>
      bookings.flatMap((booking) => {
        const customer = customers.find((customer) => customer.id === booking.customerId);
        const service = services.find((service) => service.id === booking.serviceId);

        return booking.sessions.map((session) => {
          const start = instantParts(session.startAt, bookingData.timezone);
          const end = instantParts(session.endAt, bookingData.timezone);
          return {
            ...booking,
            session,
            bookingDate: start.date,
            startTime: start.time,
            endTime: end.time,
            location: session.location,
            customerName: customer?.name ?? "Unknown Customer",
            serviceName: service?.name ?? "Unknown Service",
          };
        });
      }),
    [bookings, customers, services, bookingData.timezone],
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
    setActiveDate(calendarDateFromKey(todayKey));
  }, [todayKey]);

  const goPreviousMonth = useCallback(() => setActiveDate((current) => shiftMonthClamped(current, -1)), []);
  const goNextMonth = useCallback(() => setActiveDate((current) => shiftMonthClamped(current, 1)), []);
  const selectDate = useCallback((date: string) => setActiveDate(calendarDateFromKey(date)), []);

  const openCreateForDate = useCallback((date: string) => {
    setSelectedBooking(null);
    setInitialBookingValues({
      ...DEFAULT_BOOKING_VALUES,
      sessions: [{ ...DEFAULT_BOOKING_VALUES.sessions[0], date }],
      fullPaymentDueDate: date,
    });
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
    serviceCategories,
    createCustomerAndReturn: customerData.createCustomerAndReturn,
    createServiceAndReturn: serviceData.createServiceAndReturn,
    selectedBooking,
    initialBookingValues,
    dialogOpen,
    goPrevious,
    goNext,
    goToday,
    goPreviousMonth,
    goNextMonth,
    selectDate,
    openCreateForDate,
    openEditBooking,
    closeDialog,
    createBooking,
    updateBooking,
    deleteBooking,
    isLoading: bookingData.isLoading || customerData.isLoading || serviceData.isLoading || serviceCategoryData.isLoading,
    loadError: bookingData.loadError || customerData.loadError || serviceData.loadError || serviceCategoryData.loadError,
    retry: () => {
      bookingData.retry();
      customerData.retry();
      serviceData.retry();
      serviceCategoryData.retry();
    },
    timezone: bookingData.timezone,
    todayKey,
  };
}
