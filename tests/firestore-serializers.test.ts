import assert from "node:assert/strict"
import test from "node:test"

import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore"

import { serializeSnapshot, toIsoDate, toIsoDateTime } from "../lib/server/document-serializer"

test("toIsoDateTime handles Timestamp, Date, string, and fallbacks", () => {
  const baseDate = new Date("2023-07-15T12:34:56.000Z")
  const timestamp = Timestamp.fromDate(baseDate)

  assert.equal(toIsoDateTime(timestamp), baseDate.toISOString())
  assert.equal(toIsoDateTime(baseDate), baseDate.toISOString())
  assert.equal(toIsoDateTime("2023-07-15T12:34:56.000Z"), "2023-07-15T12:34:56.000Z")
  assert.equal(toIsoDateTime(null), null)
  assert.equal(toIsoDateTime(undefined, "fallback"), "fallback")
})

test("toIsoDate normalizes multiple input types", () => {
  const dateOnly = new Date("2024-02-05T00:00:00.000Z")
  const timestamp = Timestamp.fromDate(dateOnly)

  assert.equal(toIsoDate(timestamp), "2024-02-05")
  assert.equal(toIsoDate(dateOnly), "2024-02-05")
  assert.equal(toIsoDate("2024-02-05T08:00:00.000Z"), "2024-02-05")
  assert.equal(toIsoDate(null), null)
  assert.equal(toIsoDate(undefined, "2024-01-01"), "2024-01-01")
})

test("serializeSnapshot returns data with document id", () => {
  const doc = {
    id: "abc123",
    data: () => ({
      id: "should-be-overridden",
      amount: 42,
    }),
  } as unknown as DocumentSnapshot<Record<string, unknown>>

  const result = serializeSnapshot(doc)
  assert.equal(result.id, "abc123")
  assert.equal(result.amount, 42)
})
