# USD Expense Conversion — Design Spec

**Date:** 2026-04-21
**Status:** Approved

## Problem

Credit card expenses in USD are not being tracked in the finance dashboard. The `currency` field already exists in the data model and the form already has a currency selector, but the dashboard sums ARS and USD amounts directly without conversion — producing incorrect totals.

A Binance P2P rate endpoint (`/api/binance-rate`) exists but is unused.

## Decisions

- **Rate type:** Fixed at time of entry (not live). The rate is stored with the expense so historical totals don't change as the dollar fluctuates.
- **Rate source:** Binance P2P (existing endpoint), editable by the user to account for spread.
- **Existing USD expenses without a rate:** Excluded from ARS totals, shown with a "Sin convertir" badge. Not auto-converted retroactively.

## Data Model

Add one field to the expense document in Firestore and the Zod schema:

```
arsRate: number | null
```

- Only meaningful when `currency = "USD"`.
- Represents ARS per 1 USD at the moment of expense creation (e.g. `1450.50`).
- `null` for ARS expenses (ignored in all calculations).
- `null` for USD expenses without a stored rate → excluded from totals.

**Schema changes:** `lib/api-schemas.ts` — add `arsRate` as optional number to the expense create and update schemas.

## API Changes

### POST `/api/expenses`
- Accept `arsRate?: number` in the request body.
- Persist it to Firestore alongside the expense.

### PATCH `/api/expenses/[id]`
- Accept `arsRate?: number` in the request body.
- Allow updating the rate on existing expenses.

## UI Changes

### Add Expense Modal (`components/expenses/add-expense-modal.tsx`)

When the user selects **USD** as currency:
1. A new field **"Cotización (ARS/USD)"** appears below the amount input.
2. On mount of the field, fetch `/api/binance-rate` and pre-fill it with the returned price.
3. While fetching: show a loading skeleton on the field.
4. If the fetch fails: field is empty, user enters the rate manually.
5. The field is fully editable so the user can adjust for spread.
6. When currency switches back to ARS: the field disappears and `arsRate` is not sent.

### Expenses Table (`components/expenses/expense-table.tsx` or equivalent)

Amount column display rules:

| Case | Display |
|---|---|
| ARS expense | `$116.000` (unchanged) |
| USD expense with `arsRate` | `$116.000 (80 USD)` |
| USD expense without `arsRate` | `USD 80` + `<Badge variant="outline">Sin convertir</Badge>` |

No other columns change.

### Dashboard (`app/(secure)/dashboard/page.tsx`)

When aggregating daily expenses into year/month totals and category breakdowns:

```
if currency === "ARS"  → add amount
if currency === "USD" && arsRate !== null → add amount × arsRate
if currency === "USD" && arsRate === null → skip (exclude from totals)
```

Bills and HOA calculations are not touched — they have their own currency handling.

## Out of Scope

- Bulk retroactive conversion of existing USD expenses.
- Manual rate entry on the expense edit modal (not needed for now; the rate is set at creation time).
- Displaying a "total excluded" warning on the dashboard for expenses without a rate.
