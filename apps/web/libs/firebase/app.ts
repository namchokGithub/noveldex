import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-noveldex",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

function getFirebaseApp(): FirebaseApp {
  const existing = getApps();
  return existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
}

function initDb(): Firestore {
  const app = getFirebaseApp();
  try {
    // Vercel's Node serverless runtime breaks Firestore's default gRPC-style
    // streaming transport; long polling is the documented workaround.
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false,
    });
  } catch {
    // Already initialized (e.g. Next.js dev server hot reload) — reuse it.
    return getFirestore(app);
  }
}

export const db: Firestore = initDb();
