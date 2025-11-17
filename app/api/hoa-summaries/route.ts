import { NextRequest, NextResponse } from "next/server"

import { adminFirestore } from "@/lib/firebase-admin"
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request"

export async function GET(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request)
    const { searchParams } = request.nextUrl
    const buildingCode = searchParams.get("buildingCode")
    const unitCode = searchParams.get("unitCode")

    let queryRef = adminFirestore.collection("hoaSummaries").where("userId", "==", uid)

    if (buildingCode) {
      queryRef = queryRef.where("buildingCode", "==", buildingCode)
    }
    if (unitCode) {
      queryRef = queryRef.where("unitCode", "==", unitCode)
    }

    const snapshot = await queryRef.get()

    const toIsoString = (value: unknown): string | null => {
      if (!value) return null
      if (value instanceof Date) return value.toISOString()
      if (typeof value === "string") return value
      if (typeof value === "object" && value !== null && "toDate" in value) {
        try {
          return (value as { toDate: () => Date }).toDate().toISOString()
        } catch {
          return null
        }
      }
      return null
    }

    type HoaSummaryResponse = Record<string, unknown> & {
      id: string
      periodKey: string | null
      createdAt: string | null
      updatedAt: string | null
    }

    const summaries: HoaSummaryResponse[] = snapshot.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>
        const periodKey = typeof data.periodKey === "string" ? data.periodKey : null

        return {
          id: doc.id,
          ...data,
          periodKey,
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        }
      })
      .sort((a, b) => {
        const aKey = typeof a.periodKey === "string" ? a.periodKey : null
        const bKey = typeof b.periodKey === "string" ? b.periodKey : null
        if (!aKey || !bKey) return 0
        return bKey.localeCompare(aKey)
      })

    return NextResponse.json({ summaries })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    console.error("hoaSummaries GET error:", error)
    return NextResponse.json({ error: "Failed to load HOA summaries" }, { status: 500 })
  }
}
