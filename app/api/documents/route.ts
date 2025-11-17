import { NextRequest, NextResponse } from "next/server"

import { adminAuth, adminFirestore } from "@/lib/firebase-admin"
import { serializeDocumentSnapshot } from "@/lib/server/document-serializer"
import { documentCreateSchema } from "@/lib/server/schemas"
import { ZodError } from "zod"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const decoded = await adminAuth.verifyIdToken(token)

    const payload = documentCreateSchema.parse(await request.json())

    const docData: Record<string, unknown> = {
      userId: decoded.uid,
      fileName: payload.fileName,
      storageUrl: payload.storageUrl ?? null,
      pdfUrl: payload.storageUrl ?? null,
      status: payload.storageUrl ? "pending" : "needs_review",
      uploadedAt: new Date(),
      manualEntry: payload.manualEntry ?? false,
    }

    if (payload.provider !== undefined) docData.provider = payload.provider ?? null
    if (payload.providerId !== undefined) docData.providerId = payload.providerId ?? null
    if (payload.category !== undefined) docData.category = payload.category ?? null
    if (payload.amount !== undefined) docData.amount = payload.amount ?? null
    if (payload.totalAmount !== undefined) docData.totalAmount = payload.totalAmount ?? null
    if (payload.currency !== undefined) docData.currency = payload.currency ?? null
    if (payload.textExtract !== undefined) docData.textExtract = payload.textExtract ?? null

    docData.dueDate = payload.dueDate ?? null
    docData.issueDate = payload.issueDate ?? null
    docData.periodStart = payload.periodStart ?? null
    docData.periodEnd = payload.periodEnd ?? null

    const docRef = await adminFirestore.collection("documents").add(docData)

    return NextResponse.json({ documentId: docRef.id })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      )
    }
    console.error("Server create document error:", error)
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const decoded = await adminAuth.verifyIdToken(token)

    const snapshot = await adminFirestore.collection("documents").where("userId", "==", decoded.uid).get()

    const documents = snapshot.docs
      .map((doc) => serializeDocumentSnapshot(doc))
      .sort((a, b) => {
        const aDate = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0
        const bDate = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0
        return bDate - aDate
      })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error("Server list documents error:", error)
    return NextResponse.json({ error: "Failed to load documents" }, { status: 500 })
  }
}
