"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { addIncomeEntry } from "@/lib/income-client";
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
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddIncomeModalProps {
  onSuccess: () => void;
}

export function AddIncomeModal({ onSuccess }: AddIncomeModalProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    source: "",
    amount: "",
    currency: "ARS",
    date: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
      setFormData({
        name: "",
        source: "",
        amount: "",
        currency: "ARS",
        date: new Date().toISOString().split("T")[0],
      });
      onSuccess();
    } catch (err) {
      console.error("Failed to add income:", err);
      setError("Failed to add income entry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-500 text-slate-900 hover:bg-emerald-400">
          <Plus className="w-4 h-4 mr-2" />
          Agregar ingreso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle>Agregar ingreso</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Registrá una nueva entrada de ingreso.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              Nombre
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="p.ej., Salario diciembre, Proyecto freelance"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source" className="text-foreground">
              Fuente
            </Label>
            <Select
              value={formData.source}
              onValueChange={(value) =>
                setFormData({ ...formData, source: value })
              }
            >
              <SelectTrigger id="source" className="bg-background border-border text-foreground">
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
            <Label htmlFor="currency" className="text-foreground">
              Moneda
            </Label>
            <Select
              value={formData.currency}
              onValueChange={(value) =>
                setFormData({ ...formData, currency: value })
              }
            >
              <SelectTrigger id="currency" className="bg-background border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="ARS">ARS — Peso argentino</SelectItem>
                <SelectItem value="USD">USD — Dólar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-foreground">
              Monto ({formData.currency})
            </Label>
            <Input
              id="amount"
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
            <Label htmlFor="date" className="text-foreground">
              Fecha
            </Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="bg-background border-border text-foreground"
              required
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <DialogFooter>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 text-slate-900 hover:bg-emerald-400 w-full sm:w-auto"
            >
              {loading ? "Agregando..." : "Agregar entrada"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
