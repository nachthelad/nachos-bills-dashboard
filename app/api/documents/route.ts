import { NextRequest, NextResponse } from "next/server"

import { adminAuth, adminFirestore } from "@/lib/firebase-admin"
import { serializeDocumentSnapshot } from "@/lib/server/document-serializer"
import { documentCreateSchema } from "@/lib/server/schemas"
import { ZodError } from "zod"
import { Timestamp } from "firebase-admin/firestore"

import { adminFirestore } from "@/lib/firebase-admin"
import { serializeDocumentSnapshot } from "@/lib/server/document-serializer"
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request"

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
    const { uid } = await authenticateRequest(request)
    const payload = await request.json()
    const {
      fileName,
      storageUrl,
      provider,
      providerId,
      category,
      amount,
      totalAmount,
      currency,
      dueDate,
      issueDate,
      periodStart,
      periodEnd,
      manualEntry,
      textExtract,
    } = payload ?? {}

    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName" }, { status: 400 })
    }

    const toTimestamp = (value?: string | null) => {
      if (!value) return null
      return Timestamp.fromDate(new Date(`${value}T00:00:00Z`))
    }

    const docData: Record<string, unknown> = {
      userId: uid,
      fileName,
      storageUrl: storageUrl ?? null,
      pdfUrl: storageUrl ?? null,
      status: storageUrl ? "pending" : "needs_review",
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
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    console.error("Server create document error:", error)
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request)

    const snapshot = await adminFirestore.collection("documents").where("userId", "==", uid).get()

    const documents = snapshot.docs
      .map((doc) => serializeDocumentSnapshot(doc))
      .sort((a, b) => {
        const aDate = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0
        const bDate = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0
        return bDate - aDate
      })

    return NextResponse.json({ documents })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    console.error("Server list documents error:", error)
    return NextResponse.json({ error: "Failed to load documents" }, { status: 500 })
  }
}
