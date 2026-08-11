const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomValidationToken(bytes = 32): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  for (const value of values) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function normalizeValidationCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function createValidationCode(label: string): string {
  const prefix = label
    .normalize("NFKD")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "QAI");
  const values = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join("");
  return `${prefix}-${suffix}`;
}

export function validationSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "qai-business";
}
