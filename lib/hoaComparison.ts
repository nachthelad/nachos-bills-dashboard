import type { HoaRubro, HoaSummary } from "@/types/hoa";

export type Rubro = HoaRubro;

export type RubroDiff = {
  rubroKey: string;
  label: string;
  currentTotal: number | null;
  previousTotal: number | null;
  diffAmount: number;
  diffPercent: number | null;
  status: "new" | "removed" | "increased" | "decreased" | "unchanged";
};

export type HoaComparisonResult = {
  current: HoaSummary | null;
  previous: HoaSummary | null;
  rubroDiffs: RubroDiff[];
};

const EPSILON = 0.01;

export function compareHoaSummaries(
  current: HoaSummary | null,
  previous: HoaSummary | null
): HoaComparisonResult {
  const currentMap = buildRubroMap(current);
  const previousMap = buildRubroMap(previous);

  const keys = new Set([...currentMap.keys(), ...previousMap.keys()]);
  const rubroDiffs: RubroDiff[] = [];

  for (const key of keys) {
    const currentRubro = currentMap.get(key);
    const previousRubro = previousMap.get(key);

    const label = currentRubro?.label ?? previousRubro?.label ?? "Sin etiqueta";
    const rubroNumber =
      currentRubro?.rubroNumber ?? previousRubro?.rubroNumber ?? null;
    const currentTotal = currentRubro?.total ?? null;
    const previousTotal = previousRubro?.total ?? null;
    const currentValue = currentTotal ?? 0;
    const previousValue = previousTotal ?? 0;

    let status: RubroDiff["status"];
    if (currentRubro && !previousRubro) {
      status = "new";
    } else if (!currentRubro && previousRubro) {
      status = "removed";
    } else if (Math.abs(currentValue - previousValue) <= EPSILON) {
      status = "unchanged";
    } else if (currentValue > previousValue) {
      status = "increased";
    } else {
      status = "decreased";
    }

    const diffAmount = currentValue - previousValue;
    const diffPercent =
      previousValue > EPSILON
        ? Number(
            (((currentValue - previousValue) / previousValue) * 100).toFixed(2)
          )
        : null;

    rubroDiffs.push({
      rubroKey: buildRubroKey(rubroNumber, label),
      label,
      currentTotal,
      previousTotal,
      diffAmount,
      diffPercent,
      status,
    });
  }

  rubroDiffs.sort((a, b) => Math.abs(b.diffAmount) - Math.abs(a.diffAmount));

  return {
    current,
    previous,
    rubroDiffs,
  };
}

function buildRubroMap(summary: HoaSummary | null): Map<string, Rubro> {
  const map = new Map<string, Rubro>();
  if (!summary?.rubros) {
    return map;
  }
  summary.rubros.forEach((rubro) => {
    if (!rubro) return;
    const key = buildRubroKey(rubro.rubroNumber ?? null, rubro.label ?? "");
    if (!map.has(key)) {
      map.set(key, rubro);
    }
  });
  return map;
}

function buildRubroKey(rubroNumber: number | null, label: string | null) {
  if (rubroNumber !== null) {
    return `${rubroNumber}::`;
  }
  const normalizedLabel = (label ?? "").trim().toLowerCase();
  return `na::${normalizedLabel}`;
}
