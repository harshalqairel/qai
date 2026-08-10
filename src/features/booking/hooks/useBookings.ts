"use client";

import { useCallback, useEffect, useState } from "react";

import { Booking, CreateBookingInput, UpdateBookingInput } from "../types";
import { bookingRepository } from "../api/bookingRepository";
import type { BookingDeleteResult } from "../api/bookingRepository";
import { emitDataRefresh, subscribeToDataRefresh } from "@/lib/dataRefresh";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { cloudBookingRepository } from "@/lib/supabase/cloudRepositories";

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const retry = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = isCloudModeEnabled()
        ? await cloudBookingRepository.getAll()
        : bookingRepository.getAll();
      setBookings(loaded);
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

  const createBooking = useCallback(async (input: CreateBookingInput): Promise<boolean> => {
    const now = Date.now();
    const newBooking: Booking = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    try {
      if (isCloudModeEnabled()) await cloudBookingRepository.create(newBooking);
      else bookingRepository.create(newBooking);
      setBookings((prev) => [...prev, newBooking]);
      emitDataRefresh();
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateBooking = useCallback(async (input: UpdateBookingInput): Promise<boolean> => {
    const current = bookings.find((booking) => booking.id === input.id);
    if (!current) return false;
    const updated: Booking = { ...current, ...input, updatedAt: Date.now() };

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
  }, [bookings]);

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
    updateBooking,
    deleteBooking,
    isLoading,
    loadError,
    retry,
  };
}
