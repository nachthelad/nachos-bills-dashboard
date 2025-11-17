import { NextRequest, NextResponse } from "next/server"

import { adminFirestore } from "@/lib/firebase-admin"
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request"
import { createRequestLogger } from "@/lib/server/logger"
import { Timestamp } from "firebase-admin/firestore"

const COLLECTION = "dashboardSummaries"

export async function GET(request: NextRequest) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "GET /api/dashboard-summary" },
  })
  let log = baseLogger
  try {
    const { uid } = await authenticateRequest(request)
    log = log.withContext({ userId: uid })
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
    log.error("Dashboard summary GET error", { error })
    return NextResponse.json(
      { error: "Failed to load dashboard summary" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "POST /api/dashboard-summary" },
  })
  let log = baseLogger
  try {
    const { uid } = await authenticateRequest(request)
    log = log.withContext({ userId: uid })
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
    log.error("Dashboard summary POST error", { error })
    return NextResponse.json({ error: "Failed to save summary" }, { status: 500 })
  }
}
