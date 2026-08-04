"use client";

import { useCallback, useEffect, useState } from "react";

import { Booking, CreateBookingInput, UpdateBookingInput } from "../types";
import { bookingRepository } from "../api/bookingRepository";
import type { BookingDeleteResult } from "../api/bookingRepository";
import { emitDataRefresh, subscribeToDataRefresh } from "@/lib/dataRefresh";

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const retry = useCallback(() => {
    setIsLoading(true);
    try {
      setBookings(bookingRepository.getAll());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(retry, 0);
    const unsubscribe = subscribeToDataRefresh(retry);
    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [retry]);

  const createBooking = useCallback((input: CreateBookingInput): boolean => {
    const now = Date.now();
    const newBooking: Booking = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    try {
      bookingRepository.create(newBooking);
      setBookings((prev) => [...prev, newBooking]);
      emitDataRefresh();
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateBooking = useCallback((input: UpdateBookingInput): boolean => {
    const current = bookings.find((booking) => booking.id === input.id);
    if (!current) return false;
    const updated: Booking = { ...current, ...input, updatedAt: Date.now() };

    try {
      bookingRepository.update(updated);
      setBookings((prev) =>
        prev.map((booking) => (booking.id === updated.id ? updated : booking)),
      );
      emitDataRefresh();
      return true;
    } catch {
      return false;
    }
  }, [bookings]);

  const deleteBooking = useCallback((id: string): BookingDeleteResult | "error" => {
    try {
      const result = bookingRepository.delete(id);
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
