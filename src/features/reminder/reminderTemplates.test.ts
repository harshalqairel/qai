import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_TEMPLATES, SAMPLE_REMINDER_CONTEXT, renderReminderTemplate, scenarioTemplate, unknownReminderVariables, validateReminderTemplate } from "./reminderTemplates";

describe("reminder template rendering", () => {
  it("provides distinct defaults for due-soon and overdue scenarios", () => {
    expect(DEFAULT_REMINDER_TEMPLATES.dueSoon.whatsapp).toContain("friendly reminder");
    expect(DEFAULT_REMINDER_TEMPLATES.overdue.whatsapp).toContain("was due on");
    expect(scenarioTemplate(DEFAULT_REMINDER_TEMPLATES, "due-soon")).toBe(DEFAULT_REMINDER_TEMPLATES.dueSoon);
    expect(scenarioTemplate(DEFAULT_REMINDER_TEMPLATES, "overdue")).toBe(DEFAULT_REMINDER_TEMPLATES.overdue);
  });
  it("renders supported variables without technical identifiers", () => {
    const rendered = renderReminderTemplate("Hi {customer_name}. {remaining_amount} is due {due_date}. Next: {next_session_date}", SAMPLE_REMINDER_CONTEXT);
    expect(rendered.errors).toEqual([]);
    expect(rendered.value).toBe("Hi Sarah. Rp 1.500.000 is due 15 Aug 2026. Next: 20 Aug 2026");
    expect(rendered.value).not.toContain("undefined");
  });
  it("detects unknown variables and never leaves them unresolved", () => {
    expect(unknownReminderVariables("Hi {custmer_name} {customer_name}")).toEqual(["{custmer_name}"]);
    expect(validateReminderTemplate("Hi {custmer_name}")).toContain("Unknown variable: {custmer_name}");
    expect(renderReminderTemplate("Hi {custmer_name}", SAMPLE_REMINDER_CONTEXT).value).toBe("");
  });
  it("omits optional empty label rows gracefully", () => {
    const rendered = renderReminderTemplate("Booking: {booking_date}\nNext session: {next_session_date}\nAmount: {remaining_amount}", { ...SAMPLE_REMINDER_CONTEXT, nextSessionDate: "" });
    expect(rendered.value).toBe("Booking: 12 Aug 2026\nAmount: Rp 1.500.000");
  });
});
