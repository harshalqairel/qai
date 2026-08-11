export type ReminderMethod = "WhatsApp" | "Email";
export type ReminderType = "due-soon" | "overdue";

export type ReminderScenarioTemplate = {
  whatsapp: string;
  emailSubject: string;
  emailBody: string;
};

export type ReminderTemplateSet = {
  dueSoon: ReminderScenarioTemplate;
  overdue: ReminderScenarioTemplate;
};

export type ReminderContext = {
  customerName: string;
  businessName: string;
  serviceName: string;
  bookingDate: string;
  dueDate: string;
  bookingValue: string;
  totalPaid: string;
  remainingAmount: string;
  nextSessionDate?: string;
};

export type ReminderHistoryRecord = {
  id: string;
  businessId: string;
  bookingId: string;
  customerId: string;
  remindedAt: string;
  method: ReminderMethod;
  reminderType: ReminderType;
  outstandingBalance: number;
  dueDateSnapshot?: string;
};
