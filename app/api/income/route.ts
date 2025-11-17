import { NextRequest, NextResponse } from "next/server"

import { adminAuth, adminFirestore } from "@/lib/firebase-admin"
import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore"
import { incomeEntrySchema } from "@/lib/server/schemas"
import { ZodError } from "zod"

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const decoded = await adminAuth.verifyIdToken(token)

    const snapshot = await adminFirestore.collection("incomeEntries").where("userId", "==", decoded.uid).get()

    const entries = snapshot.docs
      .map(serializeIncomeDoc)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return NextResponse.json({ entries })
  } catch (error) {
    console.error("Income GET error:", error)
    return NextResponse.json({ error: "Failed to load income entries" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const decoded = await adminAuth.verifyIdToken(token)

    const payload = incomeEntrySchema.parse(await request.json())
    const entryDate = payload.date ?? Timestamp.now()

    const entryRef = await adminFirestore.collection("incomeEntries").add({
      userId: decoded.uid,
      amount: payload.amount,
      source: payload.source,
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
