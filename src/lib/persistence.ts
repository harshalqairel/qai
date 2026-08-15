import { z } from "zod";
import {
  discardPendingWorkspaceDocumentWrites,
  flushWorkspaceDocuments,
  queueWorkspaceDocumentWrite,
} from "@/lib/validation/workspaceSync";

export const CURRENT_STORAGE_VERSION = 1;

export type StorageEnvelope<T> = {
  version: number;
  data: T;
  updatedAt: number;
};

export type PersistenceErrorCode =
  | "INVALID_JSON"
  | "VALIDATION_FAILURE"
  | "UNSUPPORTED_VERSION"
  | "MIGRATION_FAILURE"
  | "STORAGE_UNAVAILABLE"
  | "QUOTA_EXCEEDED"
  | "SERIALIZATION_FAILURE"
  | "WRITE_FAILURE";

const ERROR_MESSAGES: Record<PersistenceErrorCode, string> = {
  INVALID_JSON: "Stored data is not valid JSON.",
  VALIDATION_FAILURE: "Stored data does not match the expected format.",
  UNSUPPORTED_VERSION: "Stored data uses an unsupported version.",
  MIGRATION_FAILURE: "Stored data could not be migrated.",
  STORAGE_UNAVAILABLE: "Local storage is unavailable.",
  QUOTA_EXCEEDED: "Local storage capacity has been exceeded.",
  SERIALIZATION_FAILURE: "Data could not be prepared for storage.",
  WRITE_FAILURE: "Data could not be written to local storage.",
};

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  readonly storageKey: string;

  constructor(code: PersistenceErrorCode, storageKey: string) {
    super(ERROR_MESSAGES[code]);
    this.name = "PersistenceError";
    this.code = code;
    this.storageKey = storageKey;
  }
}

export const storedTimestampSchema = z.number().finite().int().nonnegative();

export const storedDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

export const storedTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

type ReadCollectionOptions = {
  version?: number;
  migrateLegacy?: (records: unknown[]) => unknown[];
  migrateVersioned?: (records: unknown[], fromVersion: number) => unknown[];
};

type WriteCollectionOptions = {
  version?: number;
};

export type VersionedCollectionTransactionWrite = {
  storageKey: string;
  recordSchema: z.ZodTypeAny;
  records: readonly unknown[];
  version?: number;
};

export type BulkPersistenceStage = "local-write" | "remote-confirmation" | "rollback";

export class BulkPersistenceError extends Error {
  readonly stage: BulkPersistenceStage;
  readonly storageKey: string;

  constructor(stage: BulkPersistenceStage, storageKey: string) {
    super(`Bulk persistence failed during ${stage} for ${storageKey}.`);
    this.name = "BulkPersistenceError";
    this.stage = stage;
    this.storageKey = storageKey;
  }
}

export type CollectionSnapshot = {
  exists: boolean;
  version: number | null;
  records: unknown[];
};

const envelopeSchema = z
  .object({
    version: z.number().int().nonnegative(),
    data: z.unknown(),
    updatedAt: storedTimestampSchema,
  })
  .passthrough();

function getStorage(storageKey: string): Storage {
  if (typeof window === "undefined") {
    throw new PersistenceError("STORAGE_UNAVAILABLE", storageKey);
  }

  try {
    return window.localStorage;
  } catch {
    throw new PersistenceError("STORAGE_UNAVAILABLE", storageKey);
  }
}

function parseJson(raw: string, storageKey: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new PersistenceError("INVALID_JSON", storageKey);
  }
}

function validateRecords<T>(
  records: unknown,
  recordSchema: z.ZodType<T>,
  storageKey: string,
): T[] {
  const result = z.array(recordSchema).safeParse(records);
  if (!result.success) {
    throw new PersistenceError("VALIDATION_FAILURE", storageKey);
  }
  return result.data;
}

function serializeEnvelope<T>(envelope: StorageEnvelope<T>, storageKey: string): string {
  try {
    const serialized = JSON.stringify(envelope);
    if (typeof serialized !== "string") {
      throw new PersistenceError("SERIALIZATION_FAILURE", storageKey);
    }
    return serialized;
  } catch (error) {
    if (error instanceof PersistenceError) throw error;
    throw new PersistenceError("SERIALIZATION_FAILURE", storageKey);
  }
}

function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014)
  );
}

function isStorageUnavailable(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "SecurityError" || error.name === "InvalidStateError")
  );
}

function setStoredValue(storage: Storage, storageKey: string, serialized: string): void {
  try {
    storage.setItem(storageKey, serialized);
    queueWorkspaceDocumentWrite(storageKey, serialized);
  } catch (error) {
    if (isQuotaExceeded(error)) {
      throw new PersistenceError("QUOTA_EXCEEDED", storageKey);
    }
    if (isStorageUnavailable(error)) {
      throw new PersistenceError("STORAGE_UNAVAILABLE", storageKey);
    }
    throw new PersistenceError("WRITE_FAILURE", storageKey);
  }
}

function createEnvelope<T>(data: T, version: number): StorageEnvelope<T> {
  return {
    version,
    data,
    updatedAt: Date.now(),
  };
}

export function readVersionedCollection<T>(
  storageKey: string,
  recordSchema: z.ZodType<T>,
  options: ReadCollectionOptions = {},
): T[] {
  const storage = getStorage(storageKey);
  const targetVersion = options.version ?? CURRENT_STORAGE_VERSION;

  let raw: string | null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    throw new PersistenceError("STORAGE_UNAVAILABLE", storageKey);
  }

  if (raw === null) return [];

  const parsed = parseJson(raw, storageKey);

  if (Array.isArray(parsed)) {
    let legacyRecords: unknown[] = parsed;
    if (options.migrateLegacy) {
      try {
        legacyRecords = options.migrateLegacy(parsed);
      } catch {
        throw new PersistenceError("MIGRATION_FAILURE", storageKey);
      }
    }

    const validated = validateRecords(legacyRecords, recordSchema, storageKey);
    const serialized = serializeEnvelope(createEnvelope(validated, targetVersion), storageKey);
    setStoredValue(storage, storageKey, serialized);
    return validated;
  }

  const envelopeResult = envelopeSchema.safeParse(parsed);
  if (!envelopeResult.success) {
    throw new PersistenceError("VALIDATION_FAILURE", storageKey);
  }

  if (envelopeResult.data.version > targetVersion) {
    throw new PersistenceError("UNSUPPORTED_VERSION", storageKey);
  }

  if (envelopeResult.data.version < targetVersion) {
    if (!options.migrateVersioned || !Array.isArray(envelopeResult.data.data)) {
      throw new PersistenceError("UNSUPPORTED_VERSION", storageKey);
    }

    let migratedRecords: unknown[];
    try {
      migratedRecords = options.migrateVersioned(
        envelopeResult.data.data,
        envelopeResult.data.version,
      );
    } catch {
      throw new PersistenceError("MIGRATION_FAILURE", storageKey);
    }

    const validated = validateRecords(migratedRecords, recordSchema, storageKey);
    const serialized = serializeEnvelope(
      createEnvelope(validated, targetVersion),
      storageKey,
    );
    setStoredValue(storage, storageKey, serialized);
    return validated;
  }

  return validateRecords(envelopeResult.data.data, recordSchema, storageKey);
}

export function writeVersionedCollection<T>(
  storageKey: string,
  recordSchema: z.ZodType<T>,
  records: readonly T[],
  options: WriteCollectionOptions = {},
): void {
  const validated = validateRecords(records, recordSchema, storageKey);
  const serialized = serializeEnvelope(
    createEnvelope(validated, options.version ?? CURRENT_STORAGE_VERSION),
    storageKey,
  );
  const storage = getStorage(storageKey);
  setStoredValue(storage, storageKey, serialized);
}

/**
 * Commits several localStorage collections as one coordinated operation.
 * Every collection is validated and serialized before the first write. If any
 * write fails, previously written keys are restored to their exact snapshots.
 */
export function writeVersionedCollectionsAtomically(
  writes: readonly VersionedCollectionTransactionWrite[],
): void {
  if (writes.length === 0) return;
  const seenKeys = new Set<string>();
  const prepared = writes.map((write) => {
    if (seenKeys.has(write.storageKey)) {
      throw new PersistenceError("SERIALIZATION_FAILURE", write.storageKey);
    }
    seenKeys.add(write.storageKey);
    const validated = validateRecords(write.records, write.recordSchema, write.storageKey);
    return {
      storageKey: write.storageKey,
      serialized: serializeEnvelope(
        createEnvelope(validated, write.version ?? CURRENT_STORAGE_VERSION),
        write.storageKey,
      ),
    };
  });

  const storage = getStorage(prepared[0].storageKey);
  const snapshots = new Map<string, string | null>();
  try {
    for (const write of prepared) {
      snapshots.set(write.storageKey, storage.getItem(write.storageKey));
    }
  } catch {
    throw new PersistenceError("STORAGE_UNAVAILABLE", prepared[0].storageKey);
  }

  const applied: string[] = [];
  try {
    for (const write of prepared) {
      setStoredValue(storage, write.storageKey, write.serialized);
      applied.push(write.storageKey);
    }
  } catch (error) {
    let rollbackFailed = false;
    for (const storageKey of applied.reverse()) {
      try {
        const snapshot = snapshots.get(storageKey) ?? null;
        if (snapshot === null) storage.removeItem(storageKey);
        else storage.setItem(storageKey, snapshot);
      } catch {
        rollbackFailed = true;
      }
    }
    if (rollbackFailed) {
      throw new PersistenceError("WRITE_FAILURE", prepared[0].storageKey);
    }
    throw error;
  }
}

/**
 * Commits a validated collection batch locally and waits for validation-mode
 * remote persistence before resolving. A failed remote confirmation restores
 * every local key to its exact pre-operation value and removes the failed
 * batch from the background write queue.
 */
export async function writeVersionedCollectionsAndConfirm(
  writes: readonly VersionedCollectionTransactionWrite[],
): Promise<void> {
  if (writes.length === 0) return;
  const storageKeys = writes.map((write) => write.storageKey);
  const storage = getStorage(storageKeys[0]);
  const snapshots = new Map<string, string | null>();

  try {
    for (const storageKey of storageKeys) snapshots.set(storageKey, storage.getItem(storageKey));
  } catch {
    throw new BulkPersistenceError("local-write", storageKeys[0]);
  }

  let stage: BulkPersistenceStage = "local-write";
  try {
    writeVersionedCollectionsAtomically(writes);
    stage = "remote-confirmation";
    await flushWorkspaceDocuments(storageKeys);
  } catch (error) {
    discardPendingWorkspaceDocumentWrites(storageKeys);
    try {
      for (const storageKey of storageKeys) {
        const snapshot = snapshots.get(storageKey) ?? null;
        if (snapshot === null) storage.removeItem(storageKey);
        else storage.setItem(storageKey, snapshot);
      }
    } catch {
      throw new BulkPersistenceError("rollback", storageKeys[0]);
    }
    const failedKey = error instanceof PersistenceError ? error.storageKey : storageKeys[0];
    throw new BulkPersistenceError(stage, failedKey);
  }
}

export function readCollectionSnapshot(storageKey: string): CollectionSnapshot {
  const storage = getStorage(storageKey);

  let raw: string | null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    throw new PersistenceError("STORAGE_UNAVAILABLE", storageKey);
  }

  if (raw === null) {
    return { exists: false, version: null, records: [] };
  }

  const parsed = parseJson(raw, storageKey);
  if (Array.isArray(parsed)) {
    return { exists: true, version: 0, records: parsed };
  }

  const envelopeResult = envelopeSchema.safeParse(parsed);
  if (!envelopeResult.success || !Array.isArray(envelopeResult.data.data)) {
    throw new PersistenceError("VALIDATION_FAILURE", storageKey);
  }

  return {
    exists: true,
    version: envelopeResult.data.version,
    records: envelopeResult.data.data,
  };
}

export function toPersistenceError(
  error: unknown,
  storageKey: string,
): PersistenceError {
  if (error instanceof PersistenceError) return error;
  return new PersistenceError("WRITE_FAILURE", storageKey);
}
