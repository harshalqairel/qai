type CloudBookingError = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

export type BookingSaveOperation =
  | "save_booking_with_integrity"
  | "save_booking_with_questionnaire";

export class BookingSaveError extends Error {
  readonly code: string | null;
  readonly operation: BookingSaveOperation;
  readonly status: number | null;

  constructor(
    message: string,
    diagnostics: {
      code?: string | null;
      operation: BookingSaveOperation;
      status?: number | null;
    },
  ) {
    super(message);
    this.name = "BookingSaveError";
    this.code = diagnostics.code ?? null;
    this.operation = diagnostics.operation;
    this.status = diagnostics.status ?? null;
  }
}

function diagnosticText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return "";
  const record = error as CloudBookingError;
  return [record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

function diagnosticCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as CloudBookingError).code;
  return typeof code === "string" && code.trim() ? code : null;
}

function safeBookingSaveReason(error: unknown, status?: number | null): string {
  const code = diagnosticCode(error);
  const text = diagnosticText(error).toLowerCase();

  if (status === 401 || code === "42501" || /authentication required|jwt expired/.test(text)) {
    return "Your session cannot save bookings. Sign in again.";
  }
  if (/business membership required|booking belongs to another business/.test(text)) {
    return "This booking is not available in the current workspace.";
  }
  if (
    code === "BOOKING_INTEGRITY_MIGRATION_REQUIRED"
    || /invalid additional charge category|additional charge belongs to another booking/.test(text)
    || code === "22P02" && /category|uuid/.test(text)
  ) {
    return "The Additional Charge category could not be saved.";
  }
  if (/schedule session belongs to another booking|additional charge schedule was not found/.test(text)) {
    return "A booking schedule could not be saved.";
  }
  if (/invalid questionnaire responses/.test(text)) {
    return "The client answers could not be saved.";
  }
  if (/invalid service selection snapshot/.test(text)) {
    return "The selected Service details could not be saved.";
  }
  if (/invalid capacity slot keys|invalid capacity source request/.test(text)) {
    return "The selected booking time could not be saved.";
  }
  if (/invalid booking payload/.test(text)) {
    return "Some booking details are invalid.";
  }
  if (code === "23503") {
    return "The selected Client or Service is no longer available.";
  }
  if (code === "PGRST202" || code === "42883" || /schema cache|function .* does not exist/.test(text)) {
    return "The cloud booking service is not available yet.";
  }
  return "The cloud save failed. Try again.";
}

export function createCloudBookingSaveError(
  error: unknown,
  operation: BookingSaveOperation,
  status?: number | null,
): BookingSaveError {
  return new BookingSaveError(safeBookingSaveReason(error, status), {
    code: diagnosticCode(error),
    operation,
    status,
  });
}

export function bookingSaveErrorMessage(error: unknown): string {
  const reason = error instanceof BookingSaveError
    ? error.message
    : safeBookingSaveReason(error);
  return `Could not save the booking: ${reason}`;
}
