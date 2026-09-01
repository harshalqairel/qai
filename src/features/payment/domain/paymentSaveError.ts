type CloudPaymentError = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

export type PaymentSaveOperation = "create_payment" | "update_payment";

export class PaymentSaveError extends Error {
  readonly code: string | null;
  readonly operation: PaymentSaveOperation;
  readonly status: number | null;

  constructor(
    message: string,
    diagnostics: { code?: string | null; operation: PaymentSaveOperation; status?: number | null },
  ) {
    super(message);
    this.name = "PaymentSaveError";
    this.code = diagnostics.code ?? null;
    this.operation = diagnostics.operation;
    this.status = diagnostics.status ?? null;
  }
}

function diagnosticText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return "";
  const record = error as CloudPaymentError;
  return [record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

function diagnosticCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as CloudPaymentError).code;
  return typeof code === "string" && code.trim() ? code : null;
}

function safePaymentSaveReason(error: unknown, status?: number | null): string {
  const code = diagnosticCode(error);
  const text = diagnosticText(error).toLowerCase();
  if (status === 401 || code === "42501" || /authentication required|jwt expired/.test(text)) {
    return "Your session cannot save payments. Sign in again.";
  }
  if (/payment exceeds the booking outstanding amount/.test(text)) {
    return "The amount exceeds this booking's outstanding balance.";
  }
  if (/new payments cannot be added to a cancelled booking/.test(text)) {
    return "Payments cannot be added to a cancelled booking.";
  }
  if (/booking not found/.test(text) || code === "23503") {
    return "The booking is no longer available.";
  }
  if (code === "23505") {
    return "This payment has already been recorded.";
  }
  if (code === "22P02" || /invalid input/.test(text)) {
    return "Some payment details are invalid.";
  }
  return "The cloud save failed. Try again.";
}

export function createCloudPaymentSaveError(
  error: unknown,
  operation: PaymentSaveOperation,
  status?: number | null,
): PaymentSaveError {
  return new PaymentSaveError(safePaymentSaveReason(error, status), {
    code: diagnosticCode(error),
    operation,
    status,
  });
}

export function paymentSaveErrorMessage(error: unknown): string {
  const reason = error instanceof PaymentSaveError
    ? error.message
    : safePaymentSaveReason(error);
  return `Could not save the payment: ${reason}`;
}
