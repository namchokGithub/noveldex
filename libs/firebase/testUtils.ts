import { FirebaseError } from "firebase/app";
import { connectFirestoreEmulator } from "firebase/firestore/lite";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { db } from "./app";
import { auth, signInAdmin } from "./auth";

const EMULATOR_HOST = "127.0.0.1";
const EMULATOR_PORT = 8081;
const EMULATOR_PROJECT_ID = "demo-noveldex";
const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";

const TEST_ADMIN_EMAIL = "test-admin@example.com";
const TEST_ADMIN_PASSWORD = "test-admin-password";

let connected = false;

export async function connectFirestoreTestEmulator(): Promise<void> {
  if (connected) return;
  connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORT);
  connectAuthTestEmulator();
  try {
    await createTestAdminUser(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  } catch (error) {
    if (
      !(error instanceof FirebaseError) ||
      error.code !== "auth/email-already-in-use"
    ) {
      throw error;
    }
    // Already created by an earlier test file in this run.
  }
  await signInAdmin(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  connected = true;
}

export async function clearFirestoreEmulator(): Promise<void> {
  await fetch(
    `http://${EMULATOR_HOST}:${EMULATOR_PORT}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  );
}

let authConnected = false;

export function connectAuthTestEmulator(): void {
  if (!authConnected) {
    connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
    authConnected = true;
  }
}

export async function clearAuthEmulator(): Promise<void> {
  await fetch(
    `${AUTH_EMULATOR_URL}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/accounts`,
    { method: "DELETE" },
  );
}

export async function createTestAdminUser(
  email: string,
  password: string,
): Promise<void> {
  await createUserWithEmailAndPassword(auth, email, password);
}
