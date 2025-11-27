"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowDownLeft, ArrowUpRight, FileText, Wallet } from "lucide-react";

export interface ActivityItem {
  id: string;
  type: "expense" | "income";
  date: Date;
  dueDate?: Date | null;
  amount: number;
  description: string;
  category: string;
  status?: "parsed" | "pending" | "error" | "completed";
}

interface RecentActivityProps {
  items: ActivityItem[];
  showAmounts: boolean;
}

export function RecentActivity({ items, showAmounts }: RecentActivityProps) {
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
    }).format(date);
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow">
      <div className="p-6 flex flex-col gap-1">
        <h3 className="font-semibold leading-none tracking-tight">
          Recent Activity
        </h3>
        <p className="text-sm text-muted-foreground">
          Latest bills and income entries.
        </p>
      </div>
      <div className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Upload Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground h-24"
                >
                  No recent activity found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Avatar className="h-9 w-9">
                      <AvatarFallback
                        className={
                          item.type === "income"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-blue-500/10 text-blue-500"
                        }
                      >
                        {item.type === "income" ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{item.description}</span>
                      {item.status && item.status !== "completed" && (
                        <span className="text-xs text-muted-foreground capitalize">
                          {item.status}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {item.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(item.date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.dueDate ? formatDate(item.dueDate) : "-"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      item.type === "income" ? "text-emerald-500" : ""
                    }`}
                  >
                    {item.type === "income" ? "+" : "-"}
                    {formatCurrency(item.amount)}
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
