"use client";

import { ExternalLink, FileUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  mergeQuestionResponse,
  responseForQuestion,
  type BookingQuestion,
  type BookingQuestionFileAnswer,
  type BookingQuestionResponse,
} from "./questionnaire";

type QuestionnaireFieldsProps = {
  questions: BookingQuestion[];
  responses: BookingQuestionResponse[];
  errors?: Record<string, string>;
  onChange: (responses: BookingQuestionResponse[]) => void;
  onUploadFile?: (question: BookingQuestion, file: File) => Promise<BookingQuestionFileAnswer>;
  publicStyle?: boolean;
};

function answerFor(question: BookingQuestion, responses: BookingQuestionResponse[]) {
  return responses.find((response) => response.questionId === question.id)?.answer;
}

export function QuestionnaireFields({ questions, responses, errors = {}, onChange, onUploadFile, publicStyle = false }: QuestionnaireFieldsProps) {
  function update(question: BookingQuestion, answer: BookingQuestionResponse["answer"]) {
    onChange(mergeQuestionResponse(responses, responseForQuestion(question, answer)));
  }

  if (questions.length === 0) return null;
  return <section aria-labelledby="client-answers-heading" className={publicStyle ? "space-y-5" : "rounded-2xl border border-border bg-card p-4 sm:p-5"}>
    <div>
      <h2 id="client-answers-heading" className="font-semibold">Additional questions</h2>
      <p className={`mt-1 text-sm ${publicStyle ? "text-[#66726f]" : "text-muted-foreground"}`}>Share the details this business needs to prepare for your request.</p>
    </div>
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      {questions.map((question) => {
        const answer = answerFor(question, responses);
        const error = errors[question.id];
        const fullWidth = ["Long text", "Address / location", "File / image", "Multiple choice"].includes(question.type);
        return <div key={question.id} className={fullWidth ? "sm:col-span-2" : undefined}>
          <Label className={publicStyle ? "text-[#17272a]" : undefined}>{question.label}{question.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}</Label>
          {question.helperText && <p className={`mt-1 text-xs leading-5 ${publicStyle ? "text-[#66726f]" : "text-muted-foreground"}`}>{question.helperText}</p>}
          <div className="mt-2">
            {question.type === "Short text" && <Input value={typeof answer === "string" ? answer : ""} onChange={(event) => update(question, event.target.value)} aria-invalid={Boolean(error)} />}
            {question.type === "Long text" && <Textarea rows={4} value={typeof answer === "string" ? answer : ""} onChange={(event) => update(question, event.target.value)} aria-invalid={Boolean(error)} />}
            {question.type === "Number" && <Input type="number" inputMode="decimal" value={typeof answer === "number" ? String(answer) : ""} onChange={(event) => update(question, event.target.value === "" ? "" : Number(event.target.value))} aria-invalid={Boolean(error)} />}
            {question.type === "Date" && <Input type="date" value={typeof answer === "string" ? answer : ""} onChange={(event) => update(question, event.target.value)} aria-invalid={Boolean(error)} />}
            {question.type === "Time" && <Input type="time" value={typeof answer === "string" ? answer : ""} onChange={(event) => update(question, event.target.value)} aria-invalid={Boolean(error)} />}
            {question.type === "Address / location" && <Textarea rows={3} value={typeof answer === "string" ? answer : ""} onChange={(event) => update(question, event.target.value)} aria-invalid={Boolean(error)} />}
            {question.type === "Yes / No" && <div className="grid grid-cols-2 gap-2">{[true, false].map((choice) => <label key={String(choice)} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-semibold ${answer === choice ? publicStyle ? "border-[#356f6b] bg-[#e3eeeb]" : "border-primary bg-primary/5" : publicStyle ? "border-[#dde3dd]" : "border-border"}`}><input type="radio" name={`question-${question.id}`} checked={answer === choice} onChange={() => update(question, choice)} />{choice ? "Yes" : "No"}</label>)}</div>}
            {question.type === "Single choice" && <select className="native-control" value={typeof answer === "string" ? answer : ""} onChange={(event) => update(question, event.target.value)} aria-invalid={Boolean(error)}><option value="">Select an answer</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>}
            {question.type === "Multiple choice" && <div className="grid gap-2 sm:grid-cols-2">{question.options.map((option) => { const selected = Array.isArray(answer) && answer.includes(option); return <label key={option} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${selected ? publicStyle ? "border-[#356f6b] bg-[#e3eeeb]" : "border-primary bg-primary/5" : publicStyle ? "border-[#dde3dd]" : "border-border"}`}><input type="checkbox" checked={selected} onChange={(event) => { const current = Array.isArray(answer) ? answer : []; update(question, event.target.checked ? [...current, option] : current.filter((item) => item !== option)); }} />{option}</label>; })}</div>}
            {question.type === "File / image" && <FileQuestion answer={answer} question={question} error={error} onUploadFile={onUploadFile} onChange={(next) => update(question, next)} allowOpen={!publicStyle} />}
          </div>
          {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
        </div>;
      })}
    </div>
  </section>;
}

function FileQuestion({ answer, question, error, onUploadFile, onChange, allowOpen }: {
  answer: BookingQuestionResponse["answer"] | undefined;
  question: BookingQuestion;
  error?: string;
  onUploadFile?: QuestionnaireFieldsProps["onUploadFile"];
  onChange: (answer: BookingQuestionResponse["answer"]) => void;
  allowOpen: boolean;
}) {
  const fileAnswer = typeof answer === "object" && !Array.isArray(answer) && answer && "url" in answer ? answer as BookingQuestionFileAnswer : null;
  if (fileAnswer) return <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-3">
    <FileUp className="size-5 shrink-0 text-primary" aria-hidden="true" />
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{fileAnswer.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{Math.ceil(fileAnswer.size / 1024)} KB</p></div>
    {allowOpen && <Button type="button" size="icon-sm" variant="ghost" render={<a href={fileAnswer.url} target="_blank" rel="noreferrer" />} aria-label={`Open ${fileAnswer.name}`}><ExternalLink className="size-4" /></Button>}
    <Button type="button" size="icon-sm" variant="ghost" onClick={() => onChange("")} aria-label={`Remove ${fileAnswer.name}`}><X className="size-4" /></Button>
  </div>;
  return <Input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" aria-invalid={Boolean(error)} onChange={(event) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadFile) return;
    void onUploadFile(question, file).then(onChange).catch(() => undefined);
  }} />;
}

export function HistoricalQuestionnaireResponses({ responses }: { responses: BookingQuestionResponse[] }) {
  if (responses.length === 0) return null;
  return <section className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="historical-client-answers">
    <div><h3 id="historical-client-answers" className="font-semibold">Client answers</h3><p className="mt-1 text-xs text-muted-foreground">Labels are preserved as they appeared when the response was saved.</p></div>
    <dl className="mt-4 grid gap-4 sm:grid-cols-2">{responses.map((response) => <div key={response.questionId} className="min-w-0"><dt className="text-xs font-semibold text-muted-foreground">{response.labelSnapshot}</dt><dd className="mt-1 break-words text-sm">{formatQuestionAnswer(response.answer)}</dd></div>)}</dl>
  </section>;
}

function formatQuestionAnswer(answer: BookingQuestionResponse["answer"]): React.ReactNode {
  if (typeof answer === "boolean") return answer ? "Yes" : "No";
  if (Array.isArray(answer)) return answer.join(", ");
  if (typeof answer === "object") return <a href={answer.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">{answer.name}<ExternalLink className="size-3.5" /></a>;
  return String(answer) || "-";
}
