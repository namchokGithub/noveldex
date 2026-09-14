import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from "firebase/auth";
import { firebaseApp } from "./app";

function initAuth(): Auth {
  const authInstance = getAuth(firebaseApp);

  if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "1") {
    try {
      connectAuthEmulator(authInstance, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
    } catch {
      // Already connected (e.g. Next.js dev server hot reload) — reuse it.
    }
  }

  return authInstance;
}

export const auth: Auth = initAuth();

export async function signInAdmin(
  email: string,
  password: string,
): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}
