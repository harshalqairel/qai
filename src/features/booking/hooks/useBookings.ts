"use client";

import { useCallback, useEffect, useState } from "react";

import { Booking, CreateBookingCommand, UpdateBookingInput } from "../types";
import { bookingRepository } from "../api/bookingRepository";
import { bookingCreationRepository } from "../api/bookingCreationRepository";
import type { BookingDeleteResult } from "../api/bookingRepository";
import { emitDataRefresh, subscribeToDataRefresh } from "@/lib/dataRefresh";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { cloudBookingRepository } from "@/lib/supabase/cloudRepositories";
import { getActiveBusinessContext } from "@/lib/supabase/cloudRepositories";
import {
  buildBookingSessions,
  getDeviceTimezone,
} from "@/features/booking/utils/bookingSessions";
import { prepareBookingCreation } from "@/features/booking/domain/bookingCreation";

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [timezone, setTimezone] = useState(getDeviceTimezone);

  const retry = useCallback(async () => {
    setIsLoading(true);
    try {
      const cloudMode = isCloudModeEnabled();
      const [loaded, context] = await Promise.all([
        cloudMode ? cloudBookingRepository.getAll() : Promise.resolve(bookingRepository.getAll()),
        cloudMode ? getActiveBusinessContext() : Promise.resolve({ timezone: getDeviceTimezone() }),
      ]);
      setBookings(loaded);
      setTimezone(context.timezone);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => { void retry(); };
    const timeoutId = window.setTimeout(refresh, 0);
    const unsubscribe = subscribeToDataRefresh(refresh);
    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [retry]);

  const createBookingAndReturn = useCallback(async (command: CreateBookingCommand): Promise<Booking | null> => {
    try {
      const prepared = prepareBookingCreation(
        command,
        timezone,
        {
          bookingId: crypto.randomUUID(),
          paymentId: command.initialPayment ? crypto.randomUUID() : null,
        },
      );
      let savedBooking = prepared.booking;
      if (isCloudModeEnabled()) {
        if (prepared.initialPayment) {
          throw new Error("Cloud booking transaction is not enabled yet.");
        }
        await cloudBookingRepository.create(prepared.booking);
      } else {
        savedBooking = bookingCreationRepository.create(prepared).booking;
      }
      setBookings((prev) => prev.some((booking) => booking.id === savedBooking.id)
        ? prev
        : [...prev, savedBooking]);
      emitDataRefresh();
      return savedBooking;
    } catch {
      return null;
    }
  }, [timezone]);

  const createBooking = useCallback(async (command: CreateBookingCommand): Promise<boolean> => {
    return Boolean(await createBookingAndReturn(command));
  }, [createBookingAndReturn]);

  const updateBooking = useCallback(async (input: UpdateBookingInput): Promise<boolean> => {
    const current = bookings.find((booking) => booking.id === input.id);
    if (!current) return false;
    const now = Date.now();
    const updated: Booking = {
      ...current,
      customerId: input.customerId,
      serviceId: input.serviceId,
      sessions: buildBookingSessions(current.id, input.sessions, timezone, current.sessions, now),
      servicePrice: input.servicePrice,
      bookingStatus: input.bookingStatus,
      fullPaymentDueDate: input.fullPaymentDueDate,
      notes: input.notes,
      updatedAt: now,
    };

    try {
      if (isCloudModeEnabled()) await cloudBookingRepository.update(updated);
      else bookingRepository.update(updated);
      setBookings((prev) =>
        prev.map((booking) => (booking.id === updated.id ? updated : booking)),
      );
      emitDataRefresh();
      return true;
    } catch {
      return false;
    }
  }, [bookings, timezone]);

  const deleteBooking = useCallback(async (id: string): Promise<BookingDeleteResult | "error"> => {
    try {
      const result = isCloudModeEnabled()
        ? await cloudBookingRepository.delete(id)
        : bookingRepository.delete(id);
      if (result === "blocked") {
        return "blocked";
      }
      setBookings((prev) => prev.filter((booking) => booking.id !== id));
      emitDataRefresh();
      return "deleted";
    } catch {
      return "error";
    }
  }, []);

  return {
    bookings,
    createBooking,
    createBookingAndReturn,
    updateBooking,
    deleteBooking,
    isLoading,
    loadError,
    retry,
    timezone,
  };
}
