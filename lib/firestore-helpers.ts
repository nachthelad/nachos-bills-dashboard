import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

import type { HoaDetails } from "@/types/hoa";

import { firestore } from "./firebase";

export interface Provider {
  id: string;
  name: string;
  category: string;
}

export interface BillDocument {
  id: string;
  userId: string;
  fileName: string;
  storageUrl: string | null;
  pdfUrl?: string;
  uploadedAt: Date;
  provider?: string | null;
  providerId?: string | null;
  providerNameDetected?: string | null;
  category?: string | null;
  amount?: number | null;
  totalAmount?: number | null;
  currency?: string | null;
  dueDate?: string | null;
  issueDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  status: "pending" | "parsed" | "needs_review" | "error" | "paid";
  textExtract?: string | null;
  errorMessage?: string | null;
  lastParsedAt?: Date | null;
  parsedData?: Record<string, any>;
  hoaDetails?: HoaDetails | null;
  manualEntry?: boolean;
  updatedAt?: Date | null;
}

// Providers
function getDb() {
  if (!firestore) {
    throw new Error(
      "Firestore is not configured. Check your Firebase environment variables."
    );
  }
  return firestore;
}

export async function getProviders(): Promise<Provider[]> {
  try {
    const querySnapshot = await getDocs(collection(getDb(), "providers"));
    return querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Provider)
    );
  } catch (error) {
    console.error("Error fetching providers:", error);
    return [];
  }
}

// Documents
export async function createDocument(
  userId: string,
  documentData: Omit<BillDocument, "id">
): Promise<string> {
  const docRef = await addDoc(collection(getDb(), "documents"), {
    ...documentData,
    uploadedAt: new Date(),
  });
  return docRef.id;
}

type HasToDate = { toDate: () => Date };

function hasToDate(value: unknown): value is HasToDate {
  return Boolean(
    value &&
      typeof value === "object" &&
      "toDate" in (value as Record<string, unknown>)
  );
}

function toDateString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (hasToDate(value)) {
    return value.toDate().toISOString().slice(0, 10);
  }
  return null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (hasToDate(value)) {
    return value.toDate();
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function getUserDocuments(
  userId: string
): Promise<BillDocument[]> {
  const q = query(
    collection(getDb(), "documents"),
    where("userId", "==", userId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
        uploadedAt: toDate(doc.data().uploadedAt) ?? new Date(),
        dueDate: toDateString(doc.data().dueDate),
        issueDate: toDateString(doc.data().issueDate),
        periodStart: toDateString(doc.data().periodStart),
        periodEnd: toDateString(doc.data().periodEnd),
        lastParsedAt: toDate(doc.data().lastParsedAt),
      } as BillDocument)
  );
}

export async function getDocument(docId: string): Promise<BillDocument | null> {
  const docRef = doc(getDb(), "documents", docId);
  const docSnapshot = await getDoc(docRef);
  if (docSnapshot.exists()) {
    return {
      id: docSnapshot.id,
      ...docSnapshot.data(),
      uploadedAt: toDate(docSnapshot.data().uploadedAt) ?? new Date(),
      dueDate: toDateString(docSnapshot.data().dueDate),
      issueDate: toDateString(docSnapshot.data().issueDate),
      periodStart: toDateString(docSnapshot.data().periodStart),
      periodEnd: toDateString(docSnapshot.data().periodEnd),
      lastParsedAt: toDate(docSnapshot.data().lastParsedAt),
    } as BillDocument;
  }
  return null;
}

export async function updateDocument(
  docId: string,
  updates: Partial<BillDocument>
) {
  const docRef = doc(getDb(), "documents", docId);
  await updateDoc(docRef, updates);
}

export async function deleteDocument(docId: string) {
  const docRef = doc(getDb(), "documents", docId);
  await deleteDoc(docRef);
}
