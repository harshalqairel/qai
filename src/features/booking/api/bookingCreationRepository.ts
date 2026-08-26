import { z } from "zod";
import {
  readVersionedCollection,
  writeVersionedCollectionsAndConfirm,
  writeVersionedCollectionsAtomically,
} from "@/lib/persistence";
import {
  BOOKING_CREATION_RECEIPT_STORAGE_KEY,
  BOOKING_CREATION_RECEIPT_STORAGE_VERSION,
  BOOKING_STORAGE_KEY,
  BOOKING_STORAGE_VERSION,
} from "@/features/booking/constants";
import { bookingRecordSchema } from "@/features/booking/schema";
import type { Booking } from "@/features/booking/types";
import type { PreparedBookingCreation } from "@/features/booking/domain/bookingCreation";
import {
  PAYMENT_STORAGE_KEY,
  PAYMENT_STORAGE_VERSION,
} from "@/features/payment/constants";
import { paymentRecordSchema } from "@/features/payment/schema";
import type { Payment } from "@/features/payment/types";
import { bookingRepository } from "./bookingRepository";
import { paymentRepository } from "@/features/payment/api/paymentRepository";

const receiptSchema = z.object({
  requestId: z.string().min(1),
  bookingId: z.string().min(1),
  paymentId: z.string().min(1).nullable(),
  createdAt: z.number().finite().int().nonnegative(),
});

type BookingCreationReceipt = z.infer<typeof receiptSchema>;

export type BookingCreationResult = {
  booking: Booking;
  initialPayment: Payment | null;
  created: boolean;
};

function receipts(): BookingCreationReceipt[] {
  return readVersionedCollection(
    BOOKING_CREATION_RECEIPT_STORAGE_KEY,
    receiptSchema,
    { version: BOOKING_CREATION_RECEIPT_STORAGE_VERSION },
  );
}

function existingResult(receipt: BookingCreationReceipt): BookingCreationResult {
  const booking = bookingRepository.getAll().find((item) => item.id === receipt.bookingId);
  const initialPayment = receipt.paymentId
    ? paymentRepository.getAll().find((item) => item.id === receipt.paymentId) ?? null
    : null;
  if (!booking || (receipt.paymentId && !initialPayment)) {
    throw new Error("BOOKING_CREATION_RECEIPT_INTEGRITY_FAILURE");
  }
  return { booking, initialPayment, created: false };
}

export const bookingCreationRepository = {
  create(prepared: PreparedBookingCreation): BookingCreationResult {
    const existingReceipts = receipts();
    const previous = existingReceipts.find((item) => item.requestId === prepared.requestId);
    if (previous) return existingResult(previous);

    const bookings = bookingRepository.getAll();
    const payments = paymentRepository.getAll();
    if (bookings.some((item) => item.id === prepared.booking.id)) {
      throw new Error("DUPLICATE_BOOKING_ID");
    }
    if (prepared.initialPayment && payments.some((item) => item.id === prepared.initialPayment?.id)) {
      throw new Error("DUPLICATE_PAYMENT_ID");
    }
    if (prepared.initialPayment && prepared.initialPayment.bookingId !== prepared.booking.id) {
      throw new Error("INITIAL_PAYMENT_BOOKING_MISMATCH");
    }

    const receipt: BookingCreationReceipt = {
      requestId: prepared.requestId,
      bookingId: prepared.booking.id,
      paymentId: prepared.initialPayment?.id ?? null,
      createdAt: prepared.booking.createdAt,
    };

    writeVersionedCollectionsAtomically([
      {
        storageKey: BOOKING_STORAGE_KEY,
        recordSchema: bookingRecordSchema,
        records: [...bookings, prepared.booking],
        version: BOOKING_STORAGE_VERSION,
      },
      {
        storageKey: PAYMENT_STORAGE_KEY,
        recordSchema: paymentRecordSchema,
        records: prepared.initialPayment ? [...payments, prepared.initialPayment] : payments,
        version: PAYMENT_STORAGE_VERSION,
      },
      {
        storageKey: BOOKING_CREATION_RECEIPT_STORAGE_KEY,
        recordSchema: receiptSchema,
        records: [...existingReceipts, receipt],
        version: BOOKING_CREATION_RECEIPT_STORAGE_VERSION,
      },
    ]);

    return {
      booking: prepared.booking,
      initialPayment: prepared.initialPayment,
      created: true,
    };
  },
  async createAndConfirm(prepared: PreparedBookingCreation): Promise<BookingCreationResult> {
    const existingReceipts = receipts();
    const previous = existingReceipts.find((item) => item.requestId === prepared.requestId);
    if (previous) {
      const existing = existingResult(previous);
      await writeVersionedCollectionsAndConfirm([
        { storageKey: BOOKING_STORAGE_KEY, recordSchema: bookingRecordSchema, records: bookingRepository.getAll(), version: BOOKING_STORAGE_VERSION },
        { storageKey: PAYMENT_STORAGE_KEY, recordSchema: paymentRecordSchema, records: paymentRepository.getAll(), version: PAYMENT_STORAGE_VERSION },
        { storageKey: BOOKING_CREATION_RECEIPT_STORAGE_KEY, recordSchema: receiptSchema, records: existingReceipts, version: BOOKING_CREATION_RECEIPT_STORAGE_VERSION },
      ]);
      return existing;
    }

    const bookings = bookingRepository.getAll();
    const payments = paymentRepository.getAll();
    if (bookings.some((item) => item.id === prepared.booking.id)) throw new Error("DUPLICATE_BOOKING_ID");
    if (prepared.initialPayment && payments.some((item) => item.id === prepared.initialPayment?.id)) throw new Error("DUPLICATE_PAYMENT_ID");
    if (prepared.initialPayment && prepared.initialPayment.bookingId !== prepared.booking.id) throw new Error("INITIAL_PAYMENT_BOOKING_MISMATCH");

    const receipt: BookingCreationReceipt = {
      requestId: prepared.requestId,
      bookingId: prepared.booking.id,
      paymentId: prepared.initialPayment?.id ?? null,
      createdAt: prepared.booking.createdAt,
    };
    await writeVersionedCollectionsAndConfirm([
      { storageKey: BOOKING_STORAGE_KEY, recordSchema: bookingRecordSchema, records: [...bookings, prepared.booking], version: BOOKING_STORAGE_VERSION },
      { storageKey: PAYMENT_STORAGE_KEY, recordSchema: paymentRecordSchema, records: prepared.initialPayment ? [...payments, prepared.initialPayment] : payments, version: PAYMENT_STORAGE_VERSION },
      { storageKey: BOOKING_CREATION_RECEIPT_STORAGE_KEY, recordSchema: receiptSchema, records: [...existingReceipts, receipt], version: BOOKING_CREATION_RECEIPT_STORAGE_VERSION },
    ]);
    return { booking: prepared.booking, initialPayment: prepared.initialPayment, created: true };
  },
};
