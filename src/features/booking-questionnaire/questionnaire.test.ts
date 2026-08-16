import { describe, expect, it } from "vitest";

import {
  BOOKING_QUESTION_TYPES,
  DEFAULT_BOOKING_QUESTIONNAIRE,
  bookingQuestionnaireDefinitionSchema,
  questionsForService,
  responseForQuestion,
  validateQuestionnaireResponses,
  type BookingQuestion,
} from "./questionnaire";

function question(changes: Partial<BookingQuestion> = {}): BookingQuestion {
  return {
    id: "question-1", label: "Event concept", helperText: "Share the visual direction.", type: "Short text", required: true,
    options: [], active: true, order: 0, serviceIds: [], createdAt: 1, updatedAt: 1, ...changes,
  };
}

describe("booking questionnaire domain", () => {
  it("supports every configured question type without changing core booking fields", () => {
    const questions = BOOKING_QUESTION_TYPES.map((type, index) => question({ id: `q-${index}`, type, label: `${type} question`, required: false, order: index, options: ["Single choice", "Multiple choice"].includes(type) ? ["A", "B"] : [] }));
    const parsed = bookingQuestionnaireDefinitionSchema.parse({ ...DEFAULT_BOOKING_QUESTIONNAIRE, questions });
    expect(parsed.questions.map((item) => item.type)).toEqual(BOOKING_QUESTION_TYPES);
    expect(parsed.enabledCoreFields).toContain("service");
  });

  it("validates required and typed answers through one service-aware rule", () => {
    const definition = bookingQuestionnaireDefinitionSchema.parse({ ...DEFAULT_BOOKING_QUESTIONNAIRE, questions: [question({ serviceIds: ["wedding"] }), question({ id: "choice", label: "Finish", type: "Single choice", options: ["Natural", "Glam"], order: 1 })] });
    expect(validateQuestionnaireResponses(definition, "portrait", [])).toEqual({ choice: "Answer Finish." });
    expect(validateQuestionnaireResponses(definition, "wedding", [])).toEqual({ "question-1": "Answer Event concept.", choice: "Answer Finish." });
    expect(validateQuestionnaireResponses(definition, "wedding", [responseForQuestion(definition.questions[0], "Editorial"), responseForQuestion(definition.questions[1], "Unknown")])).toEqual({ choice: "Choose one of the available options." });
  });

  it("keeps response labels as immutable snapshots after a question is renamed or deactivated", () => {
    const original = question();
    const response = responseForQuestion(original, "Soft Korean look");
    const changed = bookingQuestionnaireDefinitionSchema.parse({ ...DEFAULT_BOOKING_QUESTIONNAIRE, questions: [{ ...original, label: "New label", active: false }] });
    expect(questionsForService(changed, "service-1")).toEqual([]);
    expect(response).toMatchObject({ questionId: original.id, labelSnapshot: "Event concept", typeSnapshot: "Short text", answer: "Soft Korean look" });
  });
});
