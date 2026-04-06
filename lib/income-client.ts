"use client";

export type IncomeEntry = {
  id: string;
  name: string;
  amount: number;
  source: string;
  currency: string;
  date: Date;
};

export async function fetchIncomeEntries(
  token: string
): Promise<IncomeEntry[]> {
  const response = await fetch("/api/income", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to fetch income entries");
  }

  const payload = await response.json();
  return (payload.entries ?? []).map((entry: any) => ({
    id: entry.id,
    name: entry.name ?? "Unnamed",
    amount: entry.amount ?? 0,
    source: entry.source ?? "Unknown",
    currency: entry.currency ?? "ARS",
    date: normalizeDateInput(entry.date),
  }));
}

export async function addIncomeEntry(
  token: string,
  data: { name: string; amount: number; source: string; currency?: string; date: Date }
): Promise<IncomeEntry> {
  const response = await fetch("/api/income", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: data.name,
      amount: data.amount,
      source: data.source,
      currency: data.currency ?? "ARS",
      date: data.date.toISOString(),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to add income entry");
  }

  const entry = await response.json();
  return {
    id: entry.id,
    name: entry.name ?? "Unnamed",
    amount: entry.amount ?? 0,
    source: entry.source ?? "Unknown",
    currency: entry.currency ?? "ARS",
    date: normalizeDateInput(entry.date),
  };
}

export async function deleteIncomeEntry(
  token: string,
  id: string
): Promise<void> {
  const response = await fetch(`/api/income/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to delete income entry");
  }
}

function normalizeDateInput(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in (value as Record<string, unknown>)
  ) {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return new Date();
    }
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  return new Date();
}
