import { NextRequest, NextResponse } from "next/server"

import { adminFirestore } from "@/lib/firebase-admin"
import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore"
import { incomeEntrySchema } from "@/lib/server/schemas"
import { ZodError } from "zod"
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request"

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request)

    const snapshot = await adminFirestore.collection("incomeEntries").where("userId", "==", uid).get()

    const entries = snapshot.docs
      .map(serializeIncomeDoc)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return NextResponse.json({ entries })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    console.error("Income GET error:", error)
    return NextResponse.json({ error: "Failed to load income entries" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request)

    const payload = incomeEntrySchema.parse(await request.json())
    const entryDate = payload.date ?? Timestamp.now()

    const entryRef = await adminFirestore.collection("incomeEntries").add({
      userId: decoded.uid,
      amount: payload.amount,
      source: payload.source,
      userId: uid,
      amount,
      source,
      currency: "ARS",
      date: entryDate,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    const entrySnapshot = await entryRef.get()
    return NextResponse.json(serializeIncomeDoc(entrySnapshot), { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      )
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    console.error("Income POST error:", error)
    return NextResponse.json({ error: "Failed to add income entry" }, { status: 500 })
  }
}

function serializeIncomeDoc(doc: DocumentSnapshot) {
  const data = doc.data() ?? {}
  const dateValue = data.date?.toDate ? data.date.toDate() : data.date ? new Date(data.date) : null
  return {
    id: doc.id,
    amount: data.amount ?? 0,
    source: data.source ?? "Unknown",
    date: dateValue ? dateValue.toISOString() : new Date().toISOString(),
    currency: data.currency ?? "ARS",
  }
}
