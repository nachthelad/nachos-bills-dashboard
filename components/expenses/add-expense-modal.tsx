"use client";

import { useState } from "react";
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
  DialogFooter,
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
          paymentMethod: editEntry.paymentMethod,
          category: editEntry.category,
        }
      : emptyForm
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
        paymentMethod: editEntry.paymentMethod,
        category: editEntry.category,
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const payload = {
        date: new Date(`${formData.date}T12:00:00Z`),
        description: formData.description,
        amount: Number.parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        category: formData.category,
      };

      if (editEntry) {
        await updateExpenseEntry(token, editEntry.id, payload);
      } else {
        await addExpenseEntry(token, payload);
      }

      setOpen(false);
      if (!editEntry) setFormData(emptyForm);
      onSuccess();
    } catch (err) {
      console.error("Failed to save expense:", err);
      setError("Failed to save expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground">
      <DialogHeader>
        <DialogTitle>{editEntry ? "Edit Expense" : "Add Expense"}</DialogTitle>
        <DialogDescription className="text-muted-foreground">
          {editEntry ? "Update the expense details." : "Record a new daily expense."}
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
            type="text"
            placeholder="ej: Carrefour, Metrogas"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-amount" className="text-foreground">
            Monto (ARS)
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
        <div className="space-y-2">
          <Label htmlFor="exp-payment-method" className="text-foreground">Medio de pago</Label>
          <div id="exp-payment-method" className="flex h-9 w-full items-center rounded-md border border-border bg-background px-3 text-sm text-muted-foreground">
            Débito
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-category" className="text-foreground">Categoría</Label>
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
            <SelectTrigger id="exp-category" className="bg-background border-border text-foreground">
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
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-emerald-500 text-slate-900 hover:bg-emerald-400 w-full sm:w-auto"
          >
            {loading
              ? editEntry
                ? "Actualizando..."
                : "Guardando..."
              : editEntry
              ? "Actualizar"
              : "Guardar"}
          </Button>
        </DialogFooter>
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
          Add Expense
        </Button>
      </DialogTrigger>
      {content}
    </Dialog>
  );
}
