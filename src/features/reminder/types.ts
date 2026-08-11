export type ReminderMethod = "WhatsApp" | "Email";

export type ReminderHistoryRecord = {
  id: string;
  bookingId: string;
  customerId: string;
  remindedAt: string;
  method: ReminderMethod;
  outstandingBalance: number;
};
