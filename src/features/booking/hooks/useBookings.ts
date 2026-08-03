"use client";

import { useCallback, useEffect, useState } from "react";

import { Booking, CreateBookingInput, UpdateBookingInput } from "../types";
import { bookingRepository } from "../api/bookingRepository";

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    try {
      const loaded = bookingRepository.getAll();
      setBookings(loaded);
    } catch (_error) {
      setBookings([]);
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

    setBookings((prev) => [...prev, newBooking]);

    try {
      bookingRepository.create(newBooking);
    } catch (_error) {
      // noop
    }

    return newBooking;
  }, []);

  const updateBooking = useCallback((input: UpdateBookingInput): void => {
    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === input.id
          ? { ...booking, ...input, updatedAt: Date.now() }
          : booking,
      ),
    );

    try {
      const current = bookings.find((booking) => booking.id === input.id);
      if (!current) return;
      bookingRepository.update({ ...current, ...input, updatedAt: Date.now() });
    } catch (_error) {
      // noop
    }
  }, [bookings]);

  const deleteBooking = useCallback((id: string): void => {
    setBookings((prev) => prev.filter((booking) => booking.id !== id));

    try {
      bookingRepository.delete(id);
    } catch (_error) {
      // noop
    }
  }, []);

  return {
    bookings,
    createBooking,
    updateBooking,
    deleteBooking,
  };
}
