import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-noveldex",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

function getFirebaseApp(): FirebaseApp {
  const existing = getApps();
  return existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
}

function initDb(): Firestore {
  const app = getFirebaseApp();
  let firestore: Firestore;
  try {
    // Vercel's Node serverless runtime breaks Firestore's default gRPC-style
    // streaming transport; long polling is the documented workaround.
    firestore = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    // Already initialized (e.g. Next.js dev server hot reload) — reuse it.
    firestore = getFirestore(app);
  }

  if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "1") {
    connectFirestoreEmulator(firestore, "127.0.0.1", 8081);
  }

  return firestore;
}

export const db: Firestore = initDb();
