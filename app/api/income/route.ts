import { NextRequest, NextResponse } from "next/server"

import { adminFirestore } from "@/lib/firebase-admin"
import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore"
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
