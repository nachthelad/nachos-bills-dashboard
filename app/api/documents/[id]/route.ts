import { NextRequest, NextResponse } from "next/server"

import { adminAuth, adminFirestore } from "@/lib/firebase-admin"
import { serializeDocumentSnapshot } from "@/lib/server/document-serializer"
import { documentUpdateSchema } from "@/lib/server/schemas"
import { ZodError } from "zod"
import { Timestamp } from "firebase-admin/firestore"

import { adminFirestore } from "@/lib/firebase-admin"
import { serializeDocumentSnapshot } from "@/lib/server/document-serializer"
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request"

type RouteContext = {
  params: Promise<{ id: string }> | { id: string }
}

async function resolveParams(params: RouteContext["params"]) {
  return typeof (params as any).then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string })
}

async function getAuthorizedDocument(request: NextRequest, params: RouteContext["params"]) {
  const { uid } = await authenticateRequest(request)
  const resolvedParams = await resolveParams(params)
  const docRef = adminFirestore.collection("documents").doc(resolvedParams.id)
  const docSnapshot = await docRef.get()

  if (!docSnapshot.exists) {
    return { errorResponse: NextResponse.json({ error: "Document not found" }, { status: 404 }) }
  }

  const documentData = docSnapshot.data()
  if (documentData?.userId && documentData.userId !== uid) {
    return { errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { docRef, docSnapshot }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await getAuthorizedDocument(request, context.params)
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse
    }

    return NextResponse.json(serializeDocumentSnapshot(authResult.docSnapshot))
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    console.error("Document GET error:", error)
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await getAuthorizedDocument(request, context.params)
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse
    }

    const { docRef } = authResult
    const payload = documentUpdateSchema.parse(await request.json())

    const updates: Record<string, any> = {}

    if (payload.provider !== undefined) updates.provider = payload.provider ?? null
    if (payload.amount !== undefined) updates.amount = payload.amount ?? null
    if (payload.status) updates.status = payload.status
    if (payload.category !== undefined) updates.category = payload.category ?? null
    if (payload.totalAmount !== undefined) updates.totalAmount = payload.totalAmount ?? null
    if (payload.currency !== undefined) updates.currency = payload.currency ?? null
    if (payload.dueDate !== undefined) updates.dueDate = payload.dueDate
    if (payload.issueDate !== undefined) updates.issueDate = payload.issueDate
    if (payload.periodStart !== undefined) updates.periodStart = payload.periodStart
    if (payload.periodEnd !== undefined) updates.periodEnd = payload.periodEnd

    updates.updatedAt = new Date()

    await docRef.update(updates)
    const updatedSnapshot = await docRef.get()

    return NextResponse.json(serializeDocumentSnapshot(updatedSnapshot))
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
    console.error("Document PATCH error:", error)
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await getAuthorizedDocument(request, context.params)
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse
    }

    const { docRef } = authResult
    await docRef.delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    console.error("Document DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
  }
}
