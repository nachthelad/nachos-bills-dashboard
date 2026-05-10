"use client";

import { useRef, useState, useEffect } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { DatePickerPopover } from "@/components/ui/date-picker-popover";
import { getLocalTodayIso, isoToDate, toIsoDate } from "@/lib/date-picker";

interface AddExpenseModalProps {
  onSuccess: () => void;
  editEntry?: ExpenseEntry | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  categories?: string[];
  onAddCategory?: (category: string) => Promise<void>;
}

function createExpenseForm(editEntry?: ExpenseEntry | null) {
  if (editEntry) {
    return {
      date: toIsoDate(editEntry.date),
      description: editEntry.description,
      amount: String(editEntry.amount),
      currency: editEntry.currency ?? "ARS",
      arsRate: editEntry.arsRate != null ? String(editEntry.arsRate) : "",
      paymentMethod: editEntry.paymentMethod,
      category: editEntry.category,
    };
  }

  return {
    date: getLocalTodayIso(),
    description: "",
    amount: "",
    currency: "ARS",
    arsRate: "",
    paymentMethod: "Débito",
    category: "Compra",
  };
}

export function AddExpenseModal({
  onSuccess,
  editEntry,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  categories: categoriesProp,
  onAddCategory,
}: AddExpenseModalProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
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

  const [formData, setFormData] = useState(() => createExpenseForm(editEntry));

  // Update form data when editEntry changes
  useEffect(() => {
    setFormData(createExpenseForm(editEntry));
  }, [editEntry]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setError(null);
      if (!editEntry) setFormData(createExpenseForm());
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
    
    // Validation
    if (!formData.description.trim()) {
      setError("La descripción es obligatoria");
      descriptionRef.current?.focus();
      return;
    }
    if (!formData.amount || Number.parseFloat(formData.amount) <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    const parsedDate = isoToDate(formData.date);
    if (!parsedDate) {
      setError("La fecha es obligatoria");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const payload = {
        date: parsedDate,
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
        setError(null);
        setTimeout(() => descriptionRef.current?.focus(), 0);
      } else {
        setOpen(false);
        if (!editEntry) setFormData(createExpenseForm());
      }
    } catch (err) {
      console.error("Failed to save expense:", err);
      setError("Error al guardar el gasto. Reintenta.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveExpense(false);
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4 px-1 pb-4">
      <div className="space-y-2">
        <Label className="text-foreground font-medium">
          Fecha
        </Label>
        <DatePickerPopover
          value={formData.date}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, date: value }))
          }
          className="w-full"
          inputClassName="h-11 bg-background border-border sm:h-9"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="exp-description" className="text-foreground font-medium">
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
          className="bg-background border-border text-foreground placeholder:text-muted-foreground h-11 sm:h-9"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="exp-currency" className="text-foreground font-medium">
            Moneda
          </Label>
          <Select
            value={formData.currency}
            onValueChange={handleCurrencyChange}
          >
            <SelectTrigger id="exp-currency" className="bg-background border-border text-foreground h-11 sm:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="ARS">ARS — Pesos</SelectItem>
              <SelectItem value="USD">USD — Dólar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-amount" className="text-foreground font-medium">
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
            className="bg-background border-border text-foreground placeholder:text-muted-foreground h-11 sm:h-9"
            required
          />
        </div>
      </div>
      {formData.currency === "USD" && (
        <div className="space-y-2">
          <Label htmlFor="exp-ars-rate" className="text-foreground font-medium">
            Cotización (ARS/USD)
          </Label>
          {arsRateLoading ? (
            <div className="h-11 sm:h-9 rounded-md border border-border bg-background animate-pulse" />
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
              className="bg-background border-border text-foreground placeholder:text-muted-foreground h-11 sm:h-9"
            />
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="exp-category" className="text-foreground font-medium">
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
              className="bg-background border-border text-foreground h-11 sm:h-9"
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
            <div className="flex gap-2 items-center mt-2">
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
                className="bg-background border-border text-foreground placeholder:text-muted-foreground h-11 sm:h-9"
                disabled={addCategoryLoading}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Confirm new category"
                className="h-11 sm:h-9 w-11 sm:w-9 text-emerald-400 hover:text-emerald-300 shrink-0"
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
                className="h-11 sm:h-9 w-11 sm:w-9 text-muted-foreground shrink-0"
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
      </div>
      {error && <p className="text-sm font-medium text-red-400 animate-in fade-in slide-in-from-top-1">{error}</p>}
      <div className={cn(
        "flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4",
        editEntry ? "sm:justify-end" : "sm:justify-between"
      )}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          className="order-3 sm:order-1 h-11 sm:h-9"
        >
          Cancelar
        </Button>
        <div className="flex flex-col sm:flex-row gap-3 order-1 sm:order-2 w-full sm:w-auto">
          {!editEntry && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => saveExpense(true)}
              className="h-11 sm:h-9 whitespace-nowrap"
            >
              Guardar y agregar otro
            </Button>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="bg-emerald-500 text-slate-900 hover:bg-emerald-400 h-11 sm:h-9 font-semibold"
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
  );

  const title = editEntry ? "Editar gasto" : "Agregar gasto";
  const description = editEntry ? "Actualizá los datos del gasto." : "Registrá un nuevo gasto diario.";

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        {!isControlled && (
          <SheetTrigger asChild>
            <Button className="bg-emerald-500 text-slate-900 hover:bg-emerald-400">
              <Plus className="w-4 h-4 mr-2" />
              Agregar gasto
            </Button>
          </SheetTrigger>
        )}
        <SheetContent side="bottom" className="px-4 pt-6 pb-8 bg-card border-border rounded-t-[20px] focus:outline-none">
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="text-xl font-bold">{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="max-h-[80vh] overflow-y-auto pr-1">
            {formContent}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button className="bg-emerald-500 text-slate-900 hover:bg-emerald-400">
            <Plus className="w-4 h-4 mr-2" />
            Agregar gasto
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[480px] bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
