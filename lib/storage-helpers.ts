import { storage } from "./firebase"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { validateUploadConstraints } from "./upload-constraints"

function getStorageInstance() {
  if (!storage) {
    throw new Error("Firebase storage is not configured. Check your Firebase environment variables.")
  }
  return storage
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function computeBrowserChecksum(file: File) {
  const data = await file.arrayBuffer()
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure checksum calculation is not supported in this browser.")
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data)
  return bufferToHex(digest)
}

export async function uploadBillFile(userId: string, file: File): Promise<string> {
  const validation = validateUploadConstraints({ size: file.size, type: file.type, name: file.name })
  if (!validation.ok) {
    throw new Error(validation.message)
  }

  const timestamp = Date.now()
  const fileName = `${timestamp}_${file.name}`
  const storageRef = ref(getStorageInstance(), `bills/${userId}/${fileName}`)
  const checksum = await computeBrowserChecksum(file)
  const uploadedAtIso = new Date().toISOString()

  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
    customMetadata: {
      userId,
      originalName: file.name,
      checksumSha256: checksum,
      uploadedAtIso,
      uploadedAtEpochMs: String(Date.now()),
      fileSizeBytes: String(file.size),
    },
  })
  const url = await getDownloadURL(storageRef)
  return url
}

export async function deleteBillFile(filePath: string) {
  const storageRef = ref(getStorageInstance(), filePath)
  await deleteObject(storageRef)
}
