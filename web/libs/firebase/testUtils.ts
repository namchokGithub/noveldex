import { connectFirestoreEmulator } from "firebase/firestore";
import { db } from "./app";

const EMULATOR_HOST = "127.0.0.1";
const EMULATOR_PORT = 8081;
const EMULATOR_PROJECT_ID = "demo-noveldex";

let connected = false;

export function useEmulator(): void {
  if (!connected) {
    connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORT);
    connected = true;
  }
}

export async function clearFirestoreEmulator(): Promise<void> {
  await fetch(
    `http://${EMULATOR_HOST}:${EMULATOR_PORT}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  );
}
