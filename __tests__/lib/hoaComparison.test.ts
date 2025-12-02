import {
  compareHoaSummaries,
  type HoaComparisonResult,
} from "@/lib/hoaComparison";
import type { HoaSummary } from "@/types/hoa";
import { describe, it } from "node:test";
import assert from "node:assert";

describe("compareHoaSummaries", () => {
  const baseSummary: HoaSummary = {
    id: "test",
    userId: "user1",
    buildingCode: "B1",
    buildingAddress: "Address",
    unitCode: "U1",
    unitLabel: "Unit 1",
    ownerName: "Owner",
    periodKey: "2025-10",
    periodYear: 2025,
    periodMonth: 10,
    periodLabel: "10/2025",
    totalToPayUnit: 1000,
    totalBuildingExpenses: 10000,
    rubros: [],
  };

  it("should match rubros by number even if labels differ slightly", () => {
    const previous: HoaSummary = {
      ...baseSummary,
      rubros: [
        {
          rubroNumber: 1,
          label: "Remuneraciones al personal",
          total: 100,
        },
      ],
    };

    const current: HoaSummary = {
      ...baseSummary,
      periodKey: "2025-11",
      rubros: [
        {
          rubroNumber: 1,
          label: "Remuneraciones al personal y cargas sociales (Rubro 1)",
          total: 120,
        },
      ],
    };

    const result: HoaComparisonResult = compareHoaSummaries(current, previous);

    // Expectation: 1 rubro diff, status "increased" (or "decreased" depending on values)
    // NOT "new" and "removed"
    assert.strictEqual(result.rubroDiffs.length, 1);
    assert.strictEqual(result.rubroDiffs[0].status, "increased");
    assert.strictEqual(result.rubroDiffs[0].diffAmount, 20);
  });

  it("should fallback to label matching if rubro number is missing", () => {
    const previous: HoaSummary = {
      ...baseSummary,
      rubros: [
        {
          rubroNumber: null,
          label: "Gastos Varios",
          total: 50,
        },
      ],
    };

    const current: HoaSummary = {
      ...baseSummary,
      periodKey: "2025-11",
      rubros: [
        {
          rubroNumber: null,
          label: "Gastos Varios",
          total: 50,
        },
      ],
    };

    const result = compareHoaSummaries(current, previous);
    assert.strictEqual(result.rubroDiffs.length, 1);
    assert.strictEqual(result.rubroDiffs[0].status, "unchanged");
  });
});
