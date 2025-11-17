import { NextRequest, NextResponse } from "next/server"

import { adminFirestore } from "@/lib/firebase-admin"
import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore"
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request"
import { serializeSnapshot, toIsoDateTime } from "@/lib/server/document-serializer"

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

    const body = await request.json()
    const amount = Number.parseFloat(body.amount)
    const source = (body.source ?? "").toString().trim() || "Salary"
    const dateString = body.date as string | undefined

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    const entryRef = await adminFirestore.collection("incomeEntries").add({
      userId: uid,
      amount,
      source,
      currency: "ARS",
      date: dateString ? Timestamp.fromDate(new Date(dateString)) : Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    const entrySnapshot = await entryRef.get()
    return NextResponse.json(serializeIncomeDoc(entrySnapshot), { status: 201 })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    console.error("Income POST error:", error)
    return NextResponse.json({ error: "Failed to add income entry" }, { status: 500 })
  }
}

function serializeIncomeDoc(doc: DocumentSnapshot) {
  const raw = (doc.data() ?? {}) as Record<string, unknown>
  const base = serializeSnapshot(doc)
  const fallbackDate = new Date().toISOString()

  return {
    ...base,
    amount: typeof raw.amount === "number" ? raw.amount : 0,
    source: typeof raw.source === "string" && raw.source.trim().length > 0 ? raw.source : "Unknown",
    date: toIsoDateTime(raw.date, fallbackDate) ?? fallbackDate,
    currency: typeof raw.currency === "string" && raw.currency.trim().length > 0 ? raw.currency : "ARS",
  }
}
