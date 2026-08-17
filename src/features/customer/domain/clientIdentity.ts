import type { Customer } from "@/features/customer/types";

export type ClientIdentityInput = Partial<Pick<Customer, "name" | "phone" | "email" | "instagram">>;
export type ClientIdentitySignal = "phone" | "email" | "instagram" | "name";

export type ClientMatch = {
  customer: Customer;
  score: number;
  signals: ClientIdentitySignal[];
  strong: boolean;
};

export function normalizeClientName(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeClientPhone(value: string | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function normalizeClientEmail(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").trim().toLowerCase();
}

export function normalizeClientInstagram(value: string | undefined): string {
  const source = (value ?? "").normalize("NFKC").trim();
  const url = source.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i);
  return (url?.[1] ?? source.replace(/^@/, "")).replace(/\/$/, "").toLowerCase();
}

export function findClientMatches(input: ClientIdentityInput, customers: readonly Customer[]): ClientMatch[] {
  const identity = {
    name: normalizeClientName(input.name),
    phone: normalizeClientPhone(input.phone),
    email: normalizeClientEmail(input.email),
    instagram: normalizeClientInstagram(input.instagram),
  };
  return customers.flatMap((customer) => {
    const signals: ClientIdentitySignal[] = [];
    if (identity.phone && normalizeClientPhone(customer.phone) === identity.phone) signals.push("phone");
    if (identity.email && normalizeClientEmail(customer.email) === identity.email) signals.push("email");
    if (identity.instagram && normalizeClientInstagram(customer.instagram) === identity.instagram) signals.push("instagram");
    if (identity.name && normalizeClientName(customer.name) === identity.name) signals.push("name");
    if (signals.length === 0) return [];
    const score = signals.reduce((total, signal) => total + ({ phone: 100, email: 80, instagram: 60, name: 10 }[signal]), 0);
    return [{ customer, score, signals, strong: signals.some((signal) => signal !== "name") }];
  }).sort((left, right) => right.score - left.score || left.customer.createdAt - right.customer.createdAt);
}

export function uniqueStrongClientMatch(input: ClientIdentityInput, customers: readonly Customer[]): Customer | null {
  const strong = findClientMatches(input, customers).filter((match) => match.strong);
  if (strong.length === 0) return null;
  const highestScore = strong[0].score;
  const highest = strong.filter((match) => match.score === highestScore);
  return highest.length === 1 ? highest[0].customer : null;
}

export function clientSecondaryIdentity(customer: Pick<Customer, "phone" | "instagram" | "email">): string {
  return [customer.phone.trim(), customer.instagram.trim(), customer.email.trim()].filter(Boolean).slice(0, 2).join(" · ");
}

export function clientSearchText(customer: Customer): string {
  return [customer.name, customer.phone, customer.instagram, customer.email].join(" ").normalize("NFKC").toLowerCase();
}
