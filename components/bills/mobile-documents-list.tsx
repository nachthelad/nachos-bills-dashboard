"use client";

import { useState } from "react";
import type { BillDocument } from "@/lib/firestore-helpers";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  ExternalLink,
  ChevronRight,
  Trash2,
  Calendar,
  DollarSign,
} from "lucide-react";
import { labelForCategory, parseLocalDay } from "@/lib/billing-utils";
import { CATEGORY_OPTIONS } from "@/config/billing/categories";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface MobileDocumentsListProps {
  documents: BillDocument[];
  showAmounts: boolean;
  onDeleteComplete?: () => void;
}

export function MobileDocumentsList({
  documents,
  showAmounts,
  onDeleteComplete,
}: MobileDocumentsListProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<BillDocument | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = (
      doc.providerNameDetected ||
      doc.provider ||
      doc.fileName ||
      ""
    )
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || doc.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "-";
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

  const handleDelete = async () => {
    if (!documentToDelete || !user) return;
    setIsDeleting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/documents/${documentToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      onDeleteComplete?.();
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error("Error deleting document:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (doc: BillDocument) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const statusStyles: Record<string, string> = {
    parsed:
      "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20",
    pending:
      "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20",
    needs_review:
      "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20",
    error: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20",
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="parsed">Parsed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
            No documents found.
          </div>
        ) : (
          filteredDocuments.map((doc) => {
            const dueDate = parseLocalDay(doc.dueDate);
            return (
              <Card key={doc.id} className="overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">
                        {doc.providerNameDetected ||
                          doc.provider ||
                          doc.fileName}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <CardDescription className="text-xs">
                          {formatDate(doc.uploadedAt)}
                        </CardDescription>
                        <Badge
                          variant="outline"
                          className={`${statusStyles[doc.status] || ""}`}
                        >
                          {doc.status === "needs_review"
                            ? "Review"
                            : doc.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground text-xs">
                        Category
                      </span>
                      <Badge variant="secondary" className="w-fit">
                        {labelForCategory(doc.category)}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-muted-foreground text-xs">
                        Amount
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(doc.amount ?? doc.totalAmount)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground text-xs">
                        Due Date
                      </span>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>{dueDate ? formatDate(dueDate) : "-"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => confirmDelete(doc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {doc.storageUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        asChild
                      >
                        <a
                          href={doc.storageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      asChild
                    >
                      <Link href={`/documents/${doc.id}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 bg-background/80">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 space-y-4 shadow-lg">
            <h3 className="text-xl font-semibold text-foreground">
              Delete document?
            </h3>
            <p className="text-sm text-muted-foreground">
              This action will remove the bill and its parsing history. You
              can’t undo this operation.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
