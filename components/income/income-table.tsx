"use client";

import { useState } from "react";
import type { IncomeEntry } from "@/lib/income-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, TrendingUp } from "lucide-react";

interface IncomeTableProps {
  entries: IncomeEntry[];
  showAmounts: boolean;
}

export function IncomeTable({ entries, showAmounts }: IncomeTableProps) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.name.toLowerCase().includes(search.toLowerCase()) ||
      entry.source.toLowerCase().includes(search.toLowerCase());
    const matchesSource =
      sourceFilter === "all" || entry.source === sourceFilter;
    return matchesSearch && matchesSource;
  });

  const formatCurrency = (amount: number) => {
    if (!showAmounts) return "••••••";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const sources = Array.from(new Set(entries.map((e) => e.source)));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search income..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((source) => (
              <SelectItem key={source} value={source}>
                {source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  No income entries found.
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-500">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      {entry.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.source}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(entry.date)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-emerald-500">
                    {formatCurrency(entry.amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
