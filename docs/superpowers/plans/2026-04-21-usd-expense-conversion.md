# USD Expense Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store an ARS/USD exchange rate alongside USD expenses and use it to correctly convert those expenses to ARS in dashboard totals and table displays.

**Architecture:** Add `arsRate: number | null` to the expense data model. The modal fetches the Binance P2P rate when the user selects USD and pre-fills an editable field. On save, the rate is stored in Firestore. The dashboard multiplies `amount × arsRate` for USD expenses; those without a rate are excluded from totals. The expense table shows `$116.000 (80 USD)` for converted entries and a "Sin convertir" badge for unconverted ones.

**Tech Stack:** Next.js App Router, Firebase/Firestore, TypeScript, Tailwind CSS, shadcn/ui

---

### Task 1: Add `arsRate` to `ExpenseEntry` type and all client functions

**Files:**
- Modify: `lib/expenses-client.ts`

- [ ] **Step 1: Add `arsRate` to `ExpenseEntry` type**

Replace lines 1–11 in `lib/expenses-client.ts`:

```typescript
"use client";

export type ExpenseEntry = {
  id: string;
  date: Date;
  description: string;
  amount: number;
  paymentMethod: "Débito" | "Crédito" | "Efectivo" | "Transferencia";
  category: string;
  currency: string;
  arsRate: number | null;
};
```

- [ ] **Step 2: Map `arsRate` in `fetchExpenseEntries`**

In `fetchExpenseEntries`, update the `.map()` call (currently lines 44–52) to include `arsRate`:

```typescript
  return (payload.entries ?? []).map((entry: any) => ({
    id: entry.id,
    date: normalizeDateInput(entry.date),
    description: entry.description ?? "",
    amount: entry.amount ?? 0,
    paymentMethod: entry.paymentMethod ?? "Débito",
    category: entry.category ?? "Otros",
    currency: entry.currency ?? "ARS",
    arsRate: typeof entry.arsRate === "number" ? entry.arsRate : null,
  }));
```

- [ ] **Step 3: Add `arsRate` param to `addExpenseEntry` and map response**

Update the function signature (currently lines 56–64) and response mapping (lines 88–96):

```typescript
export async function addExpenseEntry(
  token: string,
  data: {
    date: Date;
    description: string;
    amount: number;
    paymentMethod: string;
    category: string;
    currency?: string;
    arsRate?: number | null;
  }
): Promise<ExpenseEntry> {
  const response = await fetch("/api/expenses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      date: data.date.toISOString(),
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      category: data.category,
      currency: data.currency ?? "ARS",
      arsRate: data.arsRate ?? null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to add expense entry");
  }

  const entry = await response.json();
  return {
    id: entry.id,
    date: normalizeDateInput(entry.date),
    description: entry.description ?? "",
    amount: entry.amount ?? 0,
    paymentMethod: entry.paymentMethod ?? "Débito",
    category: entry.category ?? "Otros",
    currency: entry.currency ?? "ARS",
    arsRate: typeof entry.arsRate === "number" ? entry.arsRate : null,
  };
}
```

- [ ] **Step 4: Add `arsRate` param to `updateExpenseEntry` and map response**

Update the function signature (currently lines 99–109) and response mapping (lines 133–141):

```typescript
export async function updateExpenseEntry(
  token: string,
  id: string,
  data: {
    date: Date;
    description: string;
    amount: number;
    paymentMethod: string;
    category: string;
    currency?: string;
    arsRate?: number | null;
  }
): Promise<ExpenseEntry> {
  const response = await fetch(`/api/expenses/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      date: data.date.toISOString(),
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      category: data.category,
      currency: data.currency ?? "ARS",
      arsRate: data.arsRate ?? null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to update expense entry");
  }

  const entry = await response.json();
  return {
    id: entry.id,
    date: normalizeDateInput(entry.date),
    description: entry.description ?? "",
    amount: entry.amount ?? 0,
    paymentMethod: entry.paymentMethod ?? "Débito",
    category: entry.category ?? "Otros",
    currency: entry.currency ?? "ARS",
    arsRate: typeof entry.arsRate === "number" ? entry.arsRate : null,
  };
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/expenses-client.ts
git commit -m "feat(expenses): add arsRate field to ExpenseEntry type and client functions"
```

---

### Task 2: Update POST /api/expenses to persist `arsRate`

**Files:**
- Modify: `app/api/expenses/route.ts`

- [ ] **Step 1: Read and validate `arsRate` from request body**

After the `currency` extraction on line 58, add:

```typescript
const arsRate =
  currency === "USD" &&
  typeof body.arsRate === "number" &&
  Number.isFinite(body.arsRate) &&
  body.arsRate > 0
    ? body.arsRate
    : null;
```

- [ ] **Step 2: Persist `arsRate` in the Firestore write**

In the `.add({...})` call (lines 65–78), add `arsRate` after `currency`:

```typescript
    const entryRef = await getAdminFirestore()
      .collection("dailyExpenses")
      .add({
        userId: uid,
        description,
        amount,
        paymentMethod,
        category,
        currency,
        arsRate,
        date: dateString
          ? Timestamp.fromDate(new Date(dateString))
          : Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
```

- [ ] **Step 3: Return `arsRate` in `serializeExpenseDoc`**

In the `serializeExpenseDoc` function (lines 95–121), add `arsRate` to the returned object after `currency`:

```typescript
    currency:
      typeof raw.currency === "string" && raw.currency.trim().length > 0
        ? raw.currency
        : "ARS",
    arsRate: typeof raw.arsRate === "number" ? raw.arsRate : null,
```

- [ ] **Step 4: Commit**

```bash
git add app/api/expenses/route.ts
git commit -m "feat(api): persist arsRate on POST /api/expenses"
```

---

### Task 3: Update PATCH /api/expenses/[id] to persist `arsRate`

**Files:**
- Modify: `app/api/expenses/[id]/route.ts`

- [ ] **Step 1: Read and validate `arsRate` from request body**

After the `currency` extraction on line 45, add:

```typescript
    const arsRate =
      currency === "USD" &&
      typeof body.arsRate === "number" &&
      Number.isFinite(body.arsRate) &&
      body.arsRate > 0
        ? body.arsRate
        : null;
```

- [ ] **Step 2: Persist `arsRate` in the Firestore update**

In the `docRef.update({...})` call (lines 51–61), add `arsRate` after `currency`:

```typescript
    await docRef.update({
      description,
      amount,
      paymentMethod,
      category,
      currency,
      arsRate,
      date: dateString
        ? Timestamp.fromDate(new Date(dateString))
        : data.date,
      updatedAt: Timestamp.now(),
    });
```

- [ ] **Step 3: Return `arsRate` in the response**

In the `return NextResponse.json({...})` call (lines 68–81), add `arsRate` after `currency`:

```typescript
    return NextResponse.json({
      ...base,
      description:
        typeof raw.description === "string" ? raw.description : "Sin descripción",
      amount: typeof raw.amount === "number" ? raw.amount : 0,
      paymentMethod:
        typeof raw.paymentMethod === "string" ? raw.paymentMethod : "Débito",
      category: typeof raw.category === "string" ? raw.category : "Otros",
      currency:
        typeof raw.currency === "string" && raw.currency.trim().length > 0
          ? raw.currency
          : "ARS",
      arsRate: typeof raw.arsRate === "number" ? raw.arsRate : null,
      date: toIsoDateTime(raw.date, fallbackDate) ?? fallbackDate,
    });
```

- [ ] **Step 4: Commit**

```bash
git add app/api/expenses/[id]/route.ts
git commit -m "feat(api): persist arsRate on PATCH /api/expenses/[id]"
```

---

### Task 4: Add `formatAmountWithUsd` helper

**Files:**
- Modify: `lib/format-currency.ts`

- [ ] **Step 1: Add the new formatting function**

Append to `lib/format-currency.ts` after the existing `formatAmount` function:

```typescript
export function formatAmountWithUsd(
  amount: number,
  currency: string,
  arsRate: number | null | undefined,
  showAmounts = true
): string {
  if (!showAmounts) return "••••••";
  if (currency !== "USD") return formatAmount(amount, currency, showAmounts);
  if (arsRate != null) {
    const arsFormatted = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount * arsRate);
    const usdFormatted = new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: 2,
    }).format(amount);
    return `${arsFormatted} (${usdFormatted} USD)`;
  }
  return formatAmount(amount, "USD", showAmounts);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/format-currency.ts
git commit -m "feat(format): add formatAmountWithUsd helper"
```

---

### Task 5: Update add-expense-modal to show arsRate field

**Files:**
- Modify: `components/expenses/add-expense-modal.tsx`

- [ ] **Step 1: Add `arsRate` to `emptyForm` and form state initialization**

Update `emptyForm` (lines 40–47) to include `arsRate`:

```typescript
const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  description: "",
  amount: "",
  currency: "ARS",
  arsRate: "",
  paymentMethod: "Débito",
  category: "Compra",
};
```

Update the `editEntry` branch of `useState` (lines 72–83) to include `arsRate`:

```typescript
  const [formData, setFormData] = useState(() =>
    editEntry
      ? {
          date: editEntry.date.toISOString().split("T")[0],
          description: editEntry.description,
          amount: String(editEntry.amount),
          currency: editEntry.currency ?? "ARS",
          arsRate: editEntry.arsRate != null ? String(editEntry.arsRate) : "",
          paymentMethod: editEntry.paymentMethod,
          category: editEntry.category,
        }
      : emptyForm,
  );
```

- [ ] **Step 2: Add `arsRateLoading` state**

After the existing `useState` declarations (around line 63), add:

```typescript
  const [arsRateLoading, setArsRateLoading] = useState(false);
```

- [ ] **Step 3: Update `handleOpenChange` to reset `arsRate` when editing**

In `handleOpenChange` (lines 85–100), update the `editEntry` branch to include `arsRate`:

```typescript
    } else if (editEntry) {
      setFormData({
        date: editEntry.date.toISOString().split("T")[0],
        description: editEntry.description,
        amount: String(editEntry.amount),
        currency: editEntry.currency ?? "ARS",
        arsRate: editEntry.arsRate != null ? String(editEntry.arsRate) : "",
        paymentMethod: editEntry.paymentMethod,
        category: editEntry.category,
      });
    }
```

- [ ] **Step 4: Add `handleCurrencyChange` — replaces the inline `onValueChange` for the currency select**

Add this function after `handleOpenChange`:

```typescript
  const handleCurrencyChange = async (value: string) => {
    setFormData((prev) => ({
      ...prev,
      currency: value,
      ...(value === "ARS" ? { arsRate: "" } : {}),
    }));
    if (value === "USD") {
      setArsRateLoading(true);
      try {
        const res = await fetch("/api/binance-rate");
        if (res.ok) {
          const data = await res.json();
          setFormData((prev) => ({
            ...prev,
            arsRate: prev.arsRate || String(data.price),
          }));
        }
      } catch {
        // leave empty — user enters manually
      } finally {
        setArsRateLoading(false);
      }
    }
  };
```

- [ ] **Step 5: Wire `handleCurrencyChange` to the currency Select**

In the currency `Select` (lines 207–221), replace the `onValueChange` prop:

```tsx
          <Select
            value={formData.currency}
            onValueChange={handleCurrencyChange}
          >
```

- [ ] **Step 6: Add the arsRate input field after the amount field**

After the closing `</div>` of the amount field (after line 238), add:

```tsx
        {formData.currency === "USD" && (
          <div className="space-y-2">
            <Label htmlFor="exp-ars-rate" className="text-foreground">
              Cotización (ARS/USD)
            </Label>
            {arsRateLoading ? (
              <div className="h-9 rounded-md border border-border bg-background animate-pulse" />
            ) : (
              <Input
                id="exp-ars-rate"
                type="number"
                step="0.01"
                placeholder="Ej: 1450.00"
                value={formData.arsRate}
                onChange={(e) =>
                  setFormData({ ...formData, arsRate: e.target.value })
                }
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            )}
          </div>
        )}
```

- [ ] **Step 7: Include `arsRate` in the save payload**

In `saveExpense` (lines 118–155), update the `payload` object:

```typescript
      const payload = {
        date: new Date(`${formData.date}T12:00:00Z`),
        description: formData.description,
        amount: Number.parseFloat(formData.amount),
        currency: formData.currency,
        paymentMethod: formData.paymentMethod,
        category: formData.category,
        arsRate:
          formData.currency === "USD" && formData.arsRate
            ? Number.parseFloat(formData.arsRate)
            : null,
      };
```

- [ ] **Step 8: Clear `arsRate` when "Guardar y agregar otro" keeps the form open**

In the `keepOpen` branch (lines 141–144), clear `arsRate` along with description and amount:

```typescript
        setFormData((prev) => ({ ...prev, description: "", amount: "", arsRate: "" }));
```

- [ ] **Step 9: Commit**

```bash
git add components/expenses/add-expense-modal.tsx
git commit -m "feat(expenses): add arsRate field to expense modal with Binance rate auto-fill"
```

---

### Task 6: Update expense table amount display

**Files:**
- Modify: `components/expenses/expense-table.tsx`

- [ ] **Step 1: Import `formatAmountWithUsd`**

Replace the existing import (line 38):

```typescript
import { formatAmount, formatAmountWithUsd } from "@/lib/format-currency";
```

- [ ] **Step 2: Update the amount cell**

Replace the amount `<TableCell>` content (lines 207–215):

```tsx
                    <TableCell
                      className={`text-right font-medium whitespace-nowrap ${
                        entry.amount < 0
                          ? "text-emerald-500"
                          : "text-foreground"
                      }`}
                    >
                      {entry.currency === "USD" && entry.arsRate == null ? (
                        <span className="flex items-center justify-end gap-1.5">
                          {formatAmount(entry.amount, "USD", showAmounts)}
                          <Badge variant="outline" className="text-xs font-normal">
                            Sin convertir
                          </Badge>
                        </span>
                      ) : (
                        formatAmountWithUsd(entry.amount, entry.currency ?? "ARS", entry.arsRate, showAmounts)
                      )}
                    </TableCell>
```

- [ ] **Step 3: Commit**

```bash
git add components/expenses/expense-table.tsx
git commit -m "feat(expenses): show converted ARS amount and Sin convertir badge in table"
```

---

### Task 7: Update mobile expense list amount display

**Files:**
- Modify: `components/expenses/mobile-expense-list.tsx`

- [ ] **Step 1: Import `formatAmountWithUsd`**

Replace the existing import (line 37):

```typescript
import { formatAmount, formatAmountWithUsd } from "@/lib/format-currency";
```

- [ ] **Step 2: Update the amount display in the card**

Replace the amount `<div>` (lines 235–243):

```tsx
                    <div
                      className={`font-semibold text-lg ${
                        entry.amount < 0
                          ? "text-emerald-500"
                          : "text-foreground"
                      }`}
                    >
                      {entry.currency === "USD" && entry.arsRate == null ? (
                        <span className="flex items-center gap-1.5">
                          {formatAmount(entry.amount, "USD", showAmounts)}
                          <Badge variant="outline" className="text-xs font-normal">
                            Sin convertir
                          </Badge>
                        </span>
                      ) : (
                        formatAmountWithUsd(entry.amount, entry.currency ?? "ARS", entry.arsRate, showAmounts)
                      )}
                    </div>
```

- [ ] **Step 3: Commit**

```bash
git add components/expenses/mobile-expense-list.tsx
git commit -m "feat(expenses): show converted amount and Sin convertir badge in mobile list"
```

---

### Task 8: Update dashboard expense metrics to convert USD

**Files:**
- Modify: `app/(secure)/dashboard/page.tsx`

- [ ] **Step 1: Update `expenseMetrics` useMemo — daily expenses loop**

In the `expenseMetrics` useMemo (lines 175–233), replace the `dailyExpenses.forEach` block (lines 209–217):

```typescript
    const realMonth = new Date().getMonth();
    const realYear = new Date().getFullYear();
    let dailyExpensesTotal = 0;
    dailyExpenses.forEach((entry) => {
      if (entry.date.getFullYear() !== currentYear) return;
      const arsAmount =
        entry.currency === "USD"
          ? entry.arsRate != null
            ? entry.amount * entry.arsRate
            : null
          : entry.amount;
      if (arsAmount == null) return;
      totals.year += arsAmount;
      dailyExpensesTotal += arsAmount;
      if (currentYear === realYear && entry.date.getMonth() === realMonth) {
        totals.month += arsAmount;
      }
    });
```

- [ ] **Step 2: Update `monthlyMetrics` useMemo — daily expenses loop**

In the `monthlyMetrics` useMemo (lines 362–400), replace the `dailyExpenses.forEach` block (lines 386–389):

```typescript
    dailyExpenses.forEach((entry) => {
      if (entry.date.getFullYear() !== currentYear) return;
      const arsAmount =
        entry.currency === "USD"
          ? entry.arsRate != null
            ? entry.amount * entry.arsRate
            : null
          : entry.amount;
      if (arsAmount == null) return;
      months[entry.date.getMonth()].expenses += arsAmount;
    });
```

- [ ] **Step 3: Commit**

```bash
git add app/(secure)/dashboard/page.tsx
git commit -m "feat(dashboard): convert USD expenses using stored arsRate in totals and monthly chart"
```

---

### Task 9: Manual verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Add a USD expense**

Open `/expenses` → click "Agregar gasto" → select USD. Verify:
- The "Cotización (ARS/USD)" field appears
- It auto-fills with the Binance P2P rate (may take a second)
- The field is editable
- Save the expense

- [ ] **Step 3: Verify table display**

In the expenses table, verify the new expense shows `$116.000 (80 USD)` format (numbers depend on your test values).

- [ ] **Step 4: Verify "Sin convertir" badge**

If you have any existing USD expenses without a rate, verify they show `USD XX` + "Sin convertir" badge.

- [ ] **Step 5: Verify dashboard totals**

Open `/dashboard`. Confirm the KPI cards now include the converted USD expense in the ARS totals.

- [ ] **Step 6: Run lint**

```bash
npm run lint
```

Fix any errors before proceeding.

- [ ] **Step 7: Run build**

```bash
npm run build
```

Confirm clean build with no TypeScript errors.
