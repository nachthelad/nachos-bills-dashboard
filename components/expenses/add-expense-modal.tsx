"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  addExpenseEntry,
  updateExpenseEntry,
  EXPENSE_CATEGORIES,
  type ExpenseEntry,
} from "@/lib/expenses-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddExpenseModalProps {
  onSuccess: () => void;
  editEntry?: ExpenseEntry | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  categories?: string[];
  onAddCategory?: (category: string) => Promise<void>;
}

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  description: "",
  amount: "",
  currency: "ARS",
  arsRate: "",
  paymentMethod: "Débito",
  category: "Compra",
};

export function AddExpenseModal({
  onSuccess,
  editEntry,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  categories: categoriesProp,
  onAddCategory,
}: AddExpenseModalProps) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const [arsRateLoading, setArsRateLoading] = useState(false);
  const descriptionRef = useRef<HTMLInputElement>(null);

  const categories = categoriesProp ?? [...EXPENSE_CATEGORIES];

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

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

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setError(null);
      if (!editEntry) setFormData(emptyForm);
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
  };

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

  const handleConfirmNewCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setAddCategoryLoading(true);
    try {
      if (onAddCategory) await onAddCategory(trimmed);
      setFormData((prev) => ({ ...prev, category: trimmed }));
      setAddingCategory(false);
      setNewCategoryName("");
    } catch {
      // ignore
    } finally {
      setAddCategoryLoading(false);
    }
  };

  const saveExpense = async (keepOpen: boolean) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const payload = {
        date: new Date(`${formData.date}T12:00:00Z`),
        description: formData.description,
        amount: Number.parseFloat(formData.amount),
        currency: formData.currency,
        arsRate:
          formData.currency === "USD" && formData.arsRate
            ? Number.parseFloat(formData.arsRate)
            : null,
        paymentMethod: formData.paymentMethod,
        category: formData.category,
      };

      if (editEntry) {
        await updateExpenseEntry(token, editEntry.id, payload);
      } else {
        await addExpenseEntry(token, payload);
      }

      onSuccess();

      if (keepOpen) {
        // Keep date and category — only clear description + amount for next entry
        setFormData((prev) => ({ ...prev, description: "", amount: "" }));
        setTimeout(() => descriptionRef.current?.focus(), 0);
      } else {
        setOpen(false);
        if (!editEntry) setFormData(emptyForm);
      }
    } catch (err) {
      console.error("Failed to save expense:", err);
      setError("Failed to save expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveExpense(false);
  };

  const content = (
    <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground">
      <DialogHeader>
        <DialogTitle>{editEntry ? "Editar gasto" : "Agregar gasto"}</DialogTitle>
        <DialogDescription className="text-muted-foreground">
          {editEntry
            ? "Actualizá los datos del gasto."
            : "Registrá un nuevo gasto diario."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="exp-date" className="text-foreground">
            Fecha
          </Label>
          <Input
            id="exp-date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="bg-background border-border text-foreground"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-description" className="text-foreground">
            Descripción
          </Label>
          <Input
            id="exp-description"
            ref={descriptionRef}
            type="text"
            placeholder="p.ej. Carrefour, Supermercado, etc."
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-currency" className="text-foreground">
            Moneda
          </Label>
          <Select
            value={formData.currency}
            onValueChange={handleCurrencyChange}
          >
            <SelectTrigger id="exp-currency" className="bg-background border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="ARS">ARS — Peso argentino</SelectItem>
              <SelectItem value="USD">USD — Dólar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-amount" className="text-foreground">
            Monto ({formData.currency})
          </Label>
          <Input
            id="exp-amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
            required
          />
        </div>
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
                inputMode="decimal"
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
        <div className="space-y-2">
          <Label htmlFor="exp-payment-method" className="text-foreground">
            Método de pago
          </Label>
          <div
            id="exp-payment-method"
            className="flex h-9 w-full items-center rounded-md border border-border bg-background px-3 text-sm text-muted-foreground"
          >
            Débito
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-category" className="text-foreground">
            Categoría
          </Label>
          <Select
            value={formData.category}
            onValueChange={(value) => {
              if (value === "__new__") {
                setAddingCategory(true);
              } else {
                setFormData({ ...formData, category: value });
              }
            }}
          >
            <SelectTrigger
              id="exp-category"
              className="bg-background border-border text-foreground"
            >
              <SelectValue placeholder="Seleccionar categoría" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
              <SelectItem value="__new__" className="text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Nueva categoría...
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {addingCategory && (
            <div className="flex gap-2 items-center">
              <Input
                autoFocus
                placeholder="Nombre de la categoría"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmNewCategory();
                  } else if (e.key === "Escape") {
                    setAddingCategory(false);
                    setNewCategoryName("");
                  }
                }}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                disabled={addCategoryLoading}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Confirm new category"
                className="h-9 w-9 text-emerald-400 hover:text-emerald-300 shrink-0"
                onClick={handleConfirmNewCategory}
                disabled={addCategoryLoading || !newCategoryName.trim()}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Cancel new category"
                className="h-9 w-9 text-muted-foreground shrink-0"
                onClick={() => {
                  setAddingCategory(false);
                  setNewCategoryName("");
                }}
                disabled={addCategoryLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className={`flex items-center gap-2 pt-2 ${editEntry ? "justify-end" : "justify-between"}`}>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <div className="flex gap-2">
            {!editEntry && (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => saveExpense(true)}
              >
                Guardar y agregar otro
              </Button>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 text-slate-900 hover:bg-emerald-400"
            >
              {loading
                ? editEntry
                  ? "Actualizando..."
                  : "Guardando..."
                : editEntry
                  ? "Actualizar"
                  : "Guardar"}
            </Button>
          </div>
        </div>
      </form>
    </DialogContent>
  );

  if (isControlled) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {content}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-500 text-slate-900 hover:bg-emerald-400">
          <Plus className="w-4 h-4 mr-2" />
          Agregar gasto
        </Button>
      </DialogTrigger>
      {content}
    </Dialog>
  );
}
