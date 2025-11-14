import { collection, doc, getDocs, limit, query, setDoc } from "firebase/firestore"

import { firestore } from "./firebase"
import { PROVIDERS } from "./providers"

export async function ensureProvidersSeeded() {
  const db = firestore
  if (!db) {
    console.warn("Firestore is not available. Skipping provider seeding check.")
    return
  }

  try {
    const snapshot = await getDocs(query(collection(db, "providers"), limit(1)))
    if (!snapshot.empty) {
      return
    }

    await Promise.all(
      PROVIDERS.map((provider) => setDoc(doc(db, "providers", provider.id), provider)),
    )
    console.log("Providers collection was empty. Seeded default providers.")
  } catch (error) {
    console.error("Failed to ensure providers are seeded:", error)
  }
}
