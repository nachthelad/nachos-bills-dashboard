import { type NextRequest, NextResponse } from "next/server"

import { adminAuth, adminFirestore } from "@/lib/firebase-admin"

import { parsePdfWithOpenAI, type BillingParseResult } from "./parser"
import { Timestamp } from "firebase-admin/firestore"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const decoded = await adminAuth.verifyIdToken(token)

    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 })
    }

    const docRef = adminFirestore.collection("documents").doc(documentId)
    const docSnapshot = await docRef.get()
    if (!docSnapshot.exists) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const documentData = docSnapshot.data()
    if (documentData?.userId && documentData.userId !== decoded.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const pdfUrl = documentData?.pdfUrl ?? documentData?.storageUrl

    if (!pdfUrl) {
      return NextResponse.json({ error: "Document has no pdfUrl/storageUrl" }, { status: 400 })
    }

    let pdfBuffer: Buffer
    try {
      const pdfResponse = await fetch(pdfUrl)
      if (!pdfResponse.ok) {
        const errorBody = await pdfResponse.text()
        throw new Error(`Failed to download PDF: ${pdfResponse.status} ${errorBody}`)
      }
      const arrayBuffer = await pdfResponse.arrayBuffer()
      pdfBuffer = Buffer.from(arrayBuffer)
    } catch (error: any) {
      console.error("PDF download error:", error)
      await docRef.update({
        status: "needs_review",
        errorMessage: error.message ?? "Failed to download PDF",
        updatedAt: new Date(),
      })
      return NextResponse.json({ error: "Failed to download PDF" }, { status: 502 })
    }

    let parseResponse: BillingParseResult
    try {
      parseResponse = await parsePdfWithOpenAI(pdfBuffer)
    } catch (error: any) {
      console.error("PDF parsing error:", error)
      await docRef.update({
        status: "needs_review",
        errorMessage: error.message ?? "Failed to parse PDF",
        updatedAt: new Date(),
      })
      return NextResponse.json({ error: "Failed to parse PDF" }, { status: 502 })
    }

    const updatePayload: Record<string, any> = {
      textExtract: parseResponse.text ?? documentData?.textExtract ?? null,
      providerId: parseResponse.providerId ?? documentData?.providerId ?? null,
      providerNameDetected: parseResponse.providerNameDetected ?? documentData?.providerNameDetected ?? null,
      provider:
        parseResponse.providerNameDetected ??
        parseResponse.providerId ??
        documentData?.provider ??
        documentData?.providerNameDetected ??
        null,
      category: parseResponse.category ?? documentData?.category ?? null,
      totalAmount: parseResponse.totalAmount ?? documentData?.totalAmount ?? null,
      amount: parseResponse.totalAmount ?? documentData?.amount ?? null,
      currency: parseResponse.currency ?? documentData?.currency ?? null,
      status: parseResponse.text ? "parsed" : "needs_review",
      lastParsedAt: new Date(),
      errorMessage: null,
    }

    if ("hoaDetails" in parseResponse) {
      updatePayload.hoaDetails = parseResponse.hoaDetails ?? null
    }

    if (parseResponse.hoaDetails?.totalToPayUnit != null) {
      updatePayload.totalAmount = parseResponse.hoaDetails.totalToPayUnit
      updatePayload.amount = parseResponse.hoaDetails.totalToPayUnit
      updatePayload.currency = parseResponse.currency ?? "ARS"
      updatePayload.category = "hoa"
      if (!updatePayload.providerId) {
        updatePayload.providerId = "expensas"
      }
      if (!updatePayload.provider) {
        updatePayload.provider = parseResponse.providerNameDetected ?? "Expensas consorcio"
      }
    }

    const assignDate = (field: string, value?: string | null) => {
      if (!value) return
      const parsed = parseDate(value)
      if (parsed) {
        updatePayload[field] = Timestamp.fromDate(parsed)
      }
    }

    assignDate("issueDate", parseResponse.issueDate)
    assignDate("dueDate", parseResponse.dueDate)
    assignDate("periodStart", parseResponse.periodStart)
    assignDate("periodEnd", parseResponse.periodEnd)

    await docRef.update(updatePayload)

    if (parseResponse.hoaDetails && documentData?.userId) {
      await upsertHoaSummary(documentData.userId, parseResponse.hoaDetails)
    }

    const updatedDoc = await docRef.get()

    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() })
  } catch (error) {
    console.error("Parse route error:", error)
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 })
  }
}

function parseDate(value: string): Date | null {
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (isoMatch) {
    return new Date(`${value}T00:00:00Z`)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

async function upsertHoaSummary(userId: string, hoaDetails: any) {
  const { buildingCode, unitCode, periodYear, periodMonth } = hoaDetails ?? {}
  if (!userId || !buildingCode || !unitCode || !periodYear || !periodMonth) {
    return
  }

  const periodKey = `${periodYear}-${String(periodMonth).padStart(2, "0")}`
  const summaryId = `${userId}_${buildingCode}_${unitCode}_${periodKey}`
  const summaryRef = adminFirestore.collection("hoaSummaries").doc(summaryId)
  const now = Timestamp.now()
  const snapshot = await summaryRef.get()

  const basePayload = {
    userId,
    buildingCode,
    buildingAddress: hoaDetails.buildingAddress ?? null,
    unitCode,
    unitLabel: hoaDetails.unitLabel ?? null,
    ownerName: hoaDetails.ownerName ?? null,
    periodKey,
    periodYear,
    periodMonth,
    periodLabel: hoaDetails.periodLabel ?? `${String(periodMonth).padStart(2, "0")}/${periodYear}`,
    totalToPayUnit: hoaDetails.totalToPayUnit ?? null,
    totalBuildingExpenses: hoaDetails.totalBuildingExpenses ?? null,
    rubros: Array.isArray(hoaDetails.rubros)
      ? hoaDetails.rubros.map((r: any) => {
          const hasConvertibleTotal = r?.total !== null && r?.total !== undefined
          const numericTotal = hasConvertibleTotal ? Number(r.total) : Number.NaN
          const totalValue =
            typeof r?.total === "number" ? r.total : hasConvertibleTotal && Number.isFinite(numericTotal) ? numericTotal : null
          return {
            rubroNumber: typeof r?.rubroNumber === "number" ? r.rubroNumber : null,
            label: typeof r?.label === "string" ? r.label : null,
            total: totalValue,
          }
        })
      : [],
    updatedAt: now,
  }

  if (snapshot.exists) {
    await summaryRef.set(
      {
        ...basePayload,
        createdAt: snapshot.data()?.createdAt ?? now,
      },
      { merge: true },
    )
    return
  }

  await summaryRef.set({
    ...basePayload,
    createdAt: now,
  })
}
