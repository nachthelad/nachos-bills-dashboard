import { NextRequest, NextResponse } from "next/server"

import { adminFirestore } from "@/lib/firebase-admin"
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request"
import { Timestamp } from "firebase-admin/firestore"

const COLLECTION = "dashboardSummaries"

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request)
    const docRef = adminFirestore.collection(COLLECTION).doc(uid)
    const snapshot = await docRef.get()
    if (!snapshot.exists) {
      return NextResponse.json({ summary: null })
    }
    const data = snapshot.data()
    return NextResponse.json({
      summary: {
        totals: data?.totals ?? null,
        categories: data?.categories ?? null,
        incomeSources: data?.incomeSources ?? null,
        updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data?.updatedAt ?? null,
      },
    })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    console.error("Dashboard summary GET error:", error)
    return NextResponse.json({ summary: null }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request)
    const payload = await request.json()
    const docRef = adminFirestore.collection(COLLECTION).doc(uid)
    await docRef.set(
      {
        totals: payload.totals ?? {},
        categories: payload.categories ?? {},
        incomeSources: payload.incomeSources ?? {},
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    console.error("Dashboard summary POST error:", error)
    return NextResponse.json({ error: "Failed to save summary" }, { status: 500 })
  }
}
