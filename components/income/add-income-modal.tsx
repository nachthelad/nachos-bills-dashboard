"use client";

import { useRef, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { addIncomeEntry } from "@/lib/income-client";
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
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn, formatDate } from "@/lib/utils";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";

interface AddIncomeModalProps {
  onSuccess: () => void;
}

const emptyForm = {
  name: "",
  source: "Salary",
  amount: "",
  currency: "ARS",
  date: new Date().toISOString().split("T")[0],
};

export function AddIncomeModal({ onSuccess }: AddIncomeModalProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const nameRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setError(null);
      setFormData(emptyForm);
    }
  };

  const saveIncome = async () => {
    if (!user) return;

    // Validation
    if (!formData.name.trim()) {
      setError("El nombre es obligatorio");
      nameRef.current?.focus();
      return;
    }
    if (!formData.amount || Number.parseFloat(formData.amount) <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      await addIncomeEntry(token, {
        name: formData.name,
        amount: Number.parseFloat(formData.amount),
        source: formData.source,
        currency: formData.currency,
        date: new Date(`${formData.date}T12:00:00Z`),
      });
      setOpen(false);
      setFormData(emptyForm);
      onSuccess();
    } catch (err) {
      console.error("Failed to add income:", err);
      setError("Error al agregar el ingreso. Reintenta.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveIncome();
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4 px-1 pb-4">
      <div className="space-y-2">
        <Label htmlFor="inc-name" className="text-foreground font-medium">
          Nombre
        </Label>
        <Input
          id="inc-name"
          ref={nameRef}
          type="text"
          placeholder="p.ej., Salario diciembre, Proyecto freelance"
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          className="bg-background border-border text-foreground placeholder:text-muted-foreground h-11 sm:h-9"
          required
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="inc-source" className="text-foreground font-medium">
            Fuente
          </Label>
          <Select
            value={formData.source}
            onValueChange={(value) =>
              setFormData({ ...formData, source: value })
            }
          >
            <SelectTrigger id="inc-source" className="bg-background border-border text-foreground h-11 sm:h-9">
              <SelectValue placeholder="Seleccionar fuente" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="Salary">Salario</SelectItem>
              <SelectItem value="Freelance">Freelance</SelectItem>
              <SelectItem value="Investments">Inversiones</SelectItem>
              <SelectItem value="Other">Otros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-foreground font-medium">
            Fecha
          </Label>
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-11 sm:h-9 bg-background border-border",
                  !formData.date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.date ? (
                  formatDate(new Date(`${formData.date}T12:00:00Z`))
                ) : (
                  <span>Seleccionar fecha</span>
                )}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="z-50 rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
                align="start"
                sideOffset={4}
              >
                <DayPicker
                  mode="single"
                  selected={new Date(`${formData.date}T12:00:00Z`)}
                  onSelect={(date) => {
                    if (date) {
                      setFormData({
                        ...formData,
                        date: date.toISOString().split("T")[0],
                      });
                    }
                  }}
                locale={es}
                className="p-3"
                classNames={{
                  months: "flex flex-col sm:flex-row gap-2",
                  month: "flex flex-col gap-4",
                  month_caption: "flex justify-center pt-2 relative items-center h-10",
                  caption_label: "text-sm font-semibold text-white",
                  nav: "flex items-center",
                  button_previous: cn(
                    "absolute left-1 size-7 bg-transparent p-0 opacity-90 hover:opacity-100 border border-border rounded-md flex items-center justify-center transition-opacity text-white z-10"
                  ),
                  button_next: cn(
                    "absolute right-1 size-7 bg-transparent p-0 opacity-90 hover:opacity-100 border border-border rounded-md flex items-center justify-center transition-opacity text-white z-10"
                  ),
                  month_grid: "w-full border-collapse",
                  weekdays: "flex w-full justify-between",
                  weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",
                  weeks: "w-full",
                  week: "flex w-full mt-2 justify-between",
                  day: cn(
                    "size-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md flex items-center justify-center transition-colors relative"
                  ),
                  selected: "bg-emerald-500 text-slate-900 hover:bg-emerald-500 hover:text-slate-900 focus:bg-emerald-500 focus:text-slate-900",
                  today: "bg-accent text-accent-foreground",
                  outside: "text-muted-foreground opacity-50",
                  disabled: "text-muted-foreground opacity-50",
                  hidden: "invisible",
                }}
              />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="inc-currency" className="text-foreground font-medium">
            Moneda
          </Label>
          <Select
            value={formData.currency}
            onValueChange={(value) =>
              setFormData({ ...formData, currency: value })
            }
          >
            <SelectTrigger id="inc-currency" className="bg-background border-border text-foreground h-11 sm:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="ARS">ARS — Pesos</SelectItem>
              <SelectItem value="USD">USD — Dólar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="inc-amount" className="text-foreground font-medium">
            Monto ({formData.currency})
          </Label>
          <Input
            id="inc-amount"
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
      {error && <p className="text-sm font-medium text-red-400 animate-in fade-in slide-in-from-top-1">{error}</p>}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          className="order-2 sm:order-1 h-11 sm:h-9"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-emerald-500 text-slate-900 hover:bg-emerald-400 h-11 sm:h-9 font-semibold order-1 sm:order-2"
        >
          {loading ? "Agregando..." : "Agregar entrada"}
        </Button>
      </div>
    </form>
  );

  const title = "Agregar ingreso";
  const description = "Registrá una nueva entrada de ingreso.";

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <Button className="bg-emerald-500 text-slate-900 hover:bg-emerald-400">
            <Plus className="w-4 h-4 mr-2" />
            Agregar ingreso
          </Button>
        </SheetTrigger>
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
      <DialogTrigger asChild>
        <Button className="bg-emerald-500 text-slate-900 hover:bg-emerald-400">
          <Plus className="w-4 h-4 mr-2" />
          Agregar ingreso
        </Button>
      </DialogTrigger>
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
