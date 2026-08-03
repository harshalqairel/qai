"use client";

import { useCallback, useEffect, useState } from "react";

import { Booking, CreateBookingInput, UpdateBookingInput } from "../types";
import { bookingRepository } from "../api/bookingRepository";
import { BOOKING_STORAGE_KEY } from "../constants";
import { toPersistenceError } from "@/lib/persistence";
import type { PersistenceErrorCode } from "@/lib/persistence";

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [persistenceErrorCode, setPersistenceErrorCode] =
    useState<PersistenceErrorCode | null>(null);

  useEffect(() => {
    try {
      const loaded = bookingRepository.getAll();
      setBookings(loaded);
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, BOOKING_STORAGE_KEY).code);
    }
  }, []);

  const createBooking = useCallback((input: CreateBookingInput): Booking => {
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
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, BOOKING_STORAGE_KEY).code);
    }

    return newBooking;
  }, []);

  const updateBooking = useCallback((input: UpdateBookingInput): void => {
    const current = bookings.find((booking) => booking.id === input.id);
    if (!current) return;
    const updated: Booking = { ...current, ...input, updatedAt: Date.now() };

    try {
      bookingRepository.update(updated);
      setBookings((prev) =>
        prev.map((booking) => (booking.id === updated.id ? updated : booking)),
      );
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, BOOKING_STORAGE_KEY).code);
    }
  }, [bookings]);

  const deleteBooking = useCallback((id: string): void => {
    try {
      bookingRepository.delete(id);
      setBookings((prev) => prev.filter((booking) => booking.id !== id));
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, BOOKING_STORAGE_KEY).code);
    }
  }, []);

  return {
    bookings,
    createBooking,
    updateBooking,
    deleteBooking,
    persistenceErrorCode,
  };
}
