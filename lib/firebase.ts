import {
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

import { EnvValidationError, getClientEnv } from "./env";

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
};

export class FirebaseClientInitializationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause) {
      this.cause = options.cause;
    }
    this.name = "FirebaseClientInitializationError";
  }
}

let cachedServices: FirebaseServices | null = null;
let cachedError: FirebaseClientInitializationError | null = null;

function buildFirebaseConfig(): FirebaseOptions {
  const env = getClientEnv();
  return {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

function initializeFirebaseServices(): FirebaseServices {
  if (typeof window === "undefined") {
    throw new FirebaseClientInitializationError(
      "Firebase client SDKs are only available in the browser runtime."
    );
  }

  const config = buildFirebaseConfig();
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const authInstance = getAuth(app);

  return {
    app,
    auth: authInstance,
    firestore: getFirestore(app),
    storage: getStorage(app),
  };
}

function ensureFirebaseServices(): FirebaseServices {
  if (cachedServices) {
    return cachedServices;
  }

  if (cachedError) {
    throw cachedError;
  }

  try {
    cachedServices = initializeFirebaseServices();
    return cachedServices;
  } catch (error) {
    const wrapped =
      error instanceof FirebaseClientInitializationError
        ? error
        : new FirebaseClientInitializationError(
            error instanceof EnvValidationError
              ? error.message
              : error instanceof Error
              ? error.message
              : "Unknown Firebase initialization error",
            { cause: error }
          );
    cachedError = wrapped;
    throw wrapped;
  }
}

export function getFirebaseApp(): FirebaseApp {
  return ensureFirebaseServices().app;
}

export function getFirebaseAuth(): Auth {
  return ensureFirebaseServices().auth;
}

export function getFirebaseFirestore(): Firestore {
  return ensureFirebaseServices().firestore;
}

export function getFirebaseStorage(): FirebaseStorage {
  return ensureFirebaseServices().storage;
}

export function getFirebaseClient(): FirebaseServices {
  return ensureFirebaseServices();
}
