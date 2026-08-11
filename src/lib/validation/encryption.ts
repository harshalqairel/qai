import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const source = process.env.QAI_VALIDATION_TOKEN_ENCRYPTION_KEY?.trim();
  if (!source || source.length < 32) throw new Error("Validation token encryption is not configured.");
  return createHash("sha256").update(source).digest();
}

export function encryptValidationSecret(value: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv); const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptValidationSecret(value: string): string {
  const [version, iv, tag, encrypted] = value.split("."); if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid encrypted value.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url")); decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
