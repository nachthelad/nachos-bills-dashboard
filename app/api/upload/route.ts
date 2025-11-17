import { NextRequest, NextResponse } from "next/server"

import { adminStorage } from "@/lib/firebase-admin"
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request)

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    const userId = uid
    const originalName = (formData.get("fileName") as string) || file.name || "upload"
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const filePath = `bills/${userId}/${Date.now()}_${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const bucket = adminStorage.bucket()
    await bucket.file(filePath).save(buffer, {
      contentType: file.type || "application/octet-stream",
      resumable: false,
    })

    const storageUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(filePath)}`

    return NextResponse.json({ storageUrl, filePath })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    console.error("Server upload error:", error)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}
