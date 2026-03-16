import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWithRules } from "../app/api/parse/rules-parser";
import type { ProviderHint } from "@/config/billing/providerHints";

const HINT: ProviderHint = {
  providerId: "test",
  providerName: "Test Provider",
  category: "internet",
  keywords: ["test"],
};

function parse(text: string) {
  return parseWithRules(text, HINT);
}

// ---------------------------------------------------------------------------
// Due date — basic extraction
// ---------------------------------------------------------------------------

test("extractDueDate: date inline after keyword", () => {
  const text = `FECHA DE VENCIMIENTO: 01/04/2026\n`;
  assert.equal(parse(text).dueDate, "2026-04-01");
});

test("extractDueDate: two-line layout — label on one line, date on next", () => {
  const text = `FECHA DE VENCIMIENTO\n15/04/2026\n`;
  assert.equal(parse(text).dueDate, "2026-04-15");
});

test("extractDueDate: returns null when no due date present", () => {
  assert.equal(parse("Sin fecha aquí\nSolo texto\n").dueDate, null);
});

// ---------------------------------------------------------------------------
// Due date — date-before-keyword must NOT be picked (fallback removed)
// ---------------------------------------------------------------------------

test("extractDueDate: ignores date that precedes keyword on same line (Telecentro aviso-deuda pattern)", () => {
  // "Aviso de Deuda al 18/02/2026 Vencimiento Importe" → 18/02 is before keyword
  // The real due date appears later on its own line
  const text = [
    "Aviso de Deuda al 18/02/2026 Vencimiento Importe",
    "- $ 0,00",
    "Vencimiento: 10/03/2026",
  ].join("\n");
  assert.equal(parse(text).dueDate, "2026-03-10");
});

test("extractDueDate: picks correct date when issue date precedes VENCIMIENTO on same line (Telecentro header)", () => {
  // Telecentro's multi-column header flattened to one line by pdf2json
  const text = [
    "Factura B Fecha: 01/03/2026 Nro: 0088-57995775",
    "N° DE CLIENTE TOTAL A PAGAR VENCIMIENTO CLAVE DE PAGO",
    "10933140 $14.999,00 10/03/2026 109331403",
  ].join("\n");
  assert.equal(parse(text).dueDate, "2026-03-10");
});

// ---------------------------------------------------------------------------
// Due date — CESP lines must be skipped (Edesur pattern)
// ---------------------------------------------------------------------------

test("extractDueDate: skips CESP line and uses the real bill due date", () => {
  // Edesur: "F. Vto. CESP" has vto\b match but is secondary; 1° Vencimiento is the real one
  const text = [
    "Código CESP: 37062006166142 F. Vto. CESP: 14/02/2026",
    "1° Vencimiento: 25/02/2026",
    "TOTAL: $ 31,611.12",
    "2° Vencimiento: 02/03/2026",
  ].join("\n");
  assert.equal(parse(text).dueDate, "2026-02-25");
});

test("extractDueDate: skips CESP line even when no better candidate is present", () => {
  const text = "F. Vto. CESP: 14/02/2026\n";
  assert.equal(parse(text).dueDate, null);
});

// ---------------------------------------------------------------------------
// Due date — FIRST_DUE_RE robustness (degree sign encoding variations)
// ---------------------------------------------------------------------------

test("extractDueDate: prefers 1st-due line (exact degree sign preserved)", () => {
  const text = [
    "F. Vto. CESP: 14/02/2026",
    "1° Vencimiento: 25/02/2026",
    "2° Vencimiento: 02/03/2026",
  ].join("\n");
  assert.equal(parse(text).dueDate, "2026-02-25");
});

test("extractDueDate: prefers 1st-due line even when degree sign is dropped by pdf extractor", () => {
  // pdf2json sometimes drops the ° character, producing "1 Vencimiento"
  const text = [
    "F. Vto. CESP: 14/02/2026",
    "1 Vencimiento: 25/02/2026",
    "2 Vencimiento: 02/03/2026",
  ].join("\n");
  assert.equal(parse(text).dueDate, "2026-02-25");
});

test("extractDueDate: prefers primer/primero label", () => {
  const text = [
    "Algún vencimiento anterior 01/01/2026",
    "Primer Vencimiento: 10/03/2026",
  ].join("\n");
  assert.equal(parse(text).dueDate, "2026-03-10");
});

test("extractDueDate: prefers Vencimiento (score 8) over Vto abbreviation (score 3) even when Vto appears first (AySA pattern)", () => {
  // AySA header flattened by pdf2json: "C.E.S.P: 37075... Fecha Vto : 28/02/2026"
  // followed later by the real payment stub "Vencimiento 09/04/2026"
  const text = [
    "B18 Nº 0111B04246044 Fecha de emisión: 28/02/2026 C.E.S.P: 37075006182463 Fecha Vto : 28/02/2026",
    "Vencimiento 09/04/2026 Total a pagar $ 27.792,07",
  ].join("\n");
  assert.equal(parse(text).dueDate, "2026-04-09");
});

// ---------------------------------------------------------------------------
// Issue date
// ---------------------------------------------------------------------------

test("extractIssueDate: picks date after EMISIÓN keyword", () => {
  assert.equal(parse("FECHA DE EMISIÓN: 10/03/2026\n").issueDate, "2026-03-10");
});

test("extractIssueDate: picks date after emitida el keyword (Telecentro)", () => {
  const text = "A LA PRESENTE FACTURA FUE EMITIDA EL 01/03/2026 E INCLUYE PAGOS HASTA 18/02/2026\n";
  assert.equal(parse(text).issueDate, "2026-03-01");
});

test("extractIssueDate: picks date after bare Fecha: label", () => {
  assert.equal(parse("Factura B\nFecha: 01/03/2026\n").issueDate, "2026-03-01");
});

test("extractIssueDate: does not pick date that precedes the keyword", () => {
  // Ensures removal of fallback works — date before keyword must be ignored
  const text = "28/02/2026 algún texto Fecha de Emisión: 10/03/2026\n";
  assert.equal(parse(text).issueDate, "2026-03-10");
});

test("extractIssueDate: two-line layout", () => {
  const text = "FECHA DE EMISIÓN\n10/03/2026\n";
  assert.equal(parse(text).issueDate, "2026-03-10");
});

// ---------------------------------------------------------------------------
// Period
// ---------------------------------------------------------------------------

test("extractPeriod: two-date range format (MetroGAS style)", () => {
  const result = parse("PERIODO DE LIQUIDACIÓN: 09/01/2026 A 06/02/2026\n");
  assert.equal(result.periodStart, "2026-01-09");
  assert.equal(result.periodEnd, "2026-02-06");
});

test("extractPeriod: month name + year (Telecentro Periodo: Marzo 2026)", () => {
  const result = parse("Periodo: Marzo 2026\n");
  assert.equal(result.periodStart, "2026-03-01");
  assert.equal(result.periodEnd, "2026-03-31");
});

test("extractPeriod: MM/YYYY format", () => {
  const result = parse("Período de facturación: 03/2026\n");
  assert.equal(result.periodStart, "2026-03-01");
  assert.equal(result.periodEnd, "2026-03-31");
});

// ---------------------------------------------------------------------------
// Date validation
// ---------------------------------------------------------------------------

test("isValidBillDate: 2-digit year >= 50 treated as 19xx and rejected", () => {
  // "28/12/92" → 1992 → invalid bill date → due date not set
  assert.equal(parse("VENCIMIENTO: 28/12/92\n").dueDate, null);
});

test("isValidBillDate: 2-digit year < 50 treated as 20xx and accepted", () => {
  assert.equal(parse("VENCIMIENTO: 10/03/26\n").dueDate, "2026-03-10");
});
