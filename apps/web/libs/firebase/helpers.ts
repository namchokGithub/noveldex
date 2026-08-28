import { serverTimestamp, Timestamp, type FieldValue } from "firebase/firestore";

export function tsToIso(value: Timestamp | FieldValue | null | undefined): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : "";
}

export function withCreateTimestamps<T extends Record<string, unknown>>(
  data: T,
): T & { created_at: FieldValue; updated_at: FieldValue } {
  return { ...data, created_at: serverTimestamp(), updated_at: serverTimestamp() };
}

export function withUpdateTimestamp<T extends Record<string, unknown>>(
  data: T,
): T & { updated_at: FieldValue } {
  return { ...data, updated_at: serverTimestamp() };
}
