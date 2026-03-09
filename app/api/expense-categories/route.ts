import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const db = getAdminFirestore();
    const doc = await db.collection("expenseSettings").doc(uid).get();
    const customCategories: string[] = doc.exists
      ? (doc.data()?.customCategories ?? [])
      : [];
    return NextResponse.json({ customCategories });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return NextResponse.json(
      { error: "Failed to load categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);
    const body = await request.json();
    const category = (body.category ?? "").toString().trim();
    if (!category) {
      return NextResponse.json(
        { error: "Category name required" },
        { status: 400 }
      );
    }
    const db = getAdminFirestore();
    await db
      .collection("expenseSettings")
      .doc(uid)
      .set({ customCategories: FieldValue.arrayUnion(category) }, { merge: true });
    return NextResponse.json({ category });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return NextResponse.json(
      { error: "Failed to add category" },
      { status: 500 }
    );
  }
}
