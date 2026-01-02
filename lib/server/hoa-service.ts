import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  calculateHoaTotals,
  isNormalizedHoaDetails,
  normalizeHoaDetails,
  normalizeHoaSummaryPayload,
  type NormalizedHoaDetails,
} from "@/lib/server/hoa";

/**
 * Upserts an HOA summary into the hoaSummaries collection.
 * This is used to drive the HOA insights dashboard.
 */
export async function upsertHoaSummary(userId: string, hoaDetails: unknown) {
  // Always normalize to ensure unitCode padding and periodKey consistency
  const normalizedHoaDetails = normalizeHoaDetails(hoaDetails);

  // Use fallbacks for building and unit if missing (needed for manual entries)
  const buildingCode = normalizedHoaDetails?.buildingCode || "EDIFICIO";
  const unitCode = normalizedHoaDetails?.unitCode || "0005";
  const { periodYear, periodMonth } = normalizedHoaDetails ?? {};

  if (!normalizedHoaDetails || !userId || !periodYear || !periodMonth) {
    console.warn("Skipping HOA upsert: missing required fields", {
      userId,
      buildingCode,
      unitCode,
      periodYear,
      periodMonth,
    });
    return;
  }

  const periodKey =
    normalizedHoaDetails.periodKey ??
    `${periodYear}-${String(periodMonth).padStart(2, "0")}`;

  const summaryId = `${userId}_${buildingCode}_${unitCode}_${periodKey}`;
  const summaryRef = getAdminFirestore()
    .collection("hoaSummaries")
    .doc(summaryId);

  const now = Timestamp.now();
  const snapshot = await summaryRef.get();

  const totals = calculateHoaTotals(normalizedHoaDetails.rubros);

  const basePayload = {
    ...normalizeHoaSummaryPayload({
      userId,
      hoaDetails: normalizedHoaDetails,
      now,
    }),
    rubrosTotal: totals.rubrosTotal,
    rubrosWithTotals: totals.rubrosWithTotals,
  };

  if (snapshot.exists) {
    await summaryRef.set(
      {
        ...basePayload,
        createdAt: snapshot.data()?.createdAt ?? now,
      },
      { merge: true }
    );
    return;
  }

  await summaryRef.set({
    ...basePayload,
    createdAt: now,
  });
}
