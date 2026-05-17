import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInsightsContext,
  formatInitialInsightsResponse,
  resolveAnalysisPeriod,
} from "../app/api/expenses/insights/insights-helpers";

test("resolveAnalysisPeriod uses current month when filter is all", () => {
  const period = resolveAnalysisPeriod({
    monthFilter: "all",
    now: new Date("2026-05-17T12:00:00.000Z"),
  });

  assert.equal(period.monthFilter, "2026-05");
  assert.equal(period.monthLabel, "Mayo de 2026");
  assert.equal(period.usesCurrentMonthFallback, true);
});

test("buildInsightsContext uses the analyzed month for daily average", () => {
  const context = buildInsightsContext({
    monthFilter: "2026-02",
    entries: [
      {
        amount: 280,
        category: "Comida",
        description: "Super",
        date: "2026-02-10T12:00:00.000Z",
        currency: "ARS",
        arsRate: null,
      },
    ],
    incomeEntries: [],
    bills: [],
    hoaSummaries: [],
  });

  assert.equal(context.totals.dailyExpenses, 280);
  assert.equal(context.totals.dailyAverage, 10);
});

test("buildInsightsContext excludes USD expenses without arsRate", () => {
  const context = buildInsightsContext({
    monthFilter: "2026-05",
    entries: [
      {
        amount: 100,
        category: "Compra",
        description: "Amazon",
        date: "2026-05-10T12:00:00.000Z",
        currency: "USD",
        arsRate: null,
      },
      {
        amount: 50,
        category: "Compra",
        description: "Local",
        date: "2026-05-11T12:00:00.000Z",
        currency: "ARS",
        arsRate: null,
      },
    ],
    incomeEntries: [],
    bills: [],
    hoaSummaries: [],
  });

  assert.equal(context.totals.dailyExpenses, 50);
  assert.equal(context.skippedUsdCount, 1);
});

test("buildInsightsContext separates fixed and adjustable spending", () => {
  const context = buildInsightsContext({
    monthFilter: "2026-05",
    entries: [
      {
        amount: 120,
        category: "Servicios",
        description: "Internet",
        date: "2026-05-05T12:00:00.000Z",
        currency: "ARS",
        arsRate: null,
      },
      {
        amount: 80,
        category: "Comida",
        description: "Super",
        date: "2026-05-06T12:00:00.000Z",
        currency: "ARS",
        arsRate: null,
      },
    ],
    incomeEntries: [],
    bills: [
      {
        providerName: "VISA Santander",
        totalAmount: 200,
        category: "credit_card",
        dueDate: "2026-05-15T12:00:00.000Z",
      },
    ],
    hoaSummaries: [
      {
        periodKey: "2026-05",
        periodLabel: "Mayo 2026",
        totalToPayUnit: 300,
      },
    ],
  });

  assert.deepEqual(
    context.fixedItems.map((item) => item.label),
    ["Expensas (Mayo 2026)", "VISA Santander", "Servicios"]
  );
  assert.deepEqual(
    context.adjustableItems.map((item) => item.label),
    ["Comida"]
  );
  assert.equal(context.hasCreditCardBill, true);
});

test("formatInitialInsightsResponse keeps canonical sections", () => {
  const context = buildInsightsContext({
    monthFilter: "2026-05",
    entries: [
      {
        amount: 150,
        category: "Otros",
        description: "Varios",
        date: "2026-05-05T12:00:00.000Z",
        currency: "ARS",
        arsRate: null,
      },
    ],
    incomeEntries: [
      {
        amount: 1000,
        source: "Salary",
        name: "Sueldo",
        date: "2026-05-01T12:00:00.000Z",
      },
    ],
    bills: [],
    hoaSummaries: [],
  });

  const text = formatInitialInsightsResponse(context, {
    summary: "Tus gastos están controlados.",
    fixedObservation: "No hay compromisos fijos relevantes cargados.",
    adjustableObservation: "El mayor margen está en Otros.",
    actions: [
      "Definí un tope para Otros.",
      "Revisá compras de impulso.",
      "Reservá un monto fijo para ahorro.",
    ],
    caveat: null,
  });

  assert.match(text, /^Resumen/m);
  assert.match(text, /^Gastos fijos/m);
  assert.match(text, /^Gastos ajustables/m);
  assert.match(text, /^3 acciones concretas/m);
  assert.doesNotMatch(text, /\$\./);
});
