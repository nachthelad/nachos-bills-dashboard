"use client";

import { useState } from "react";
import type { BillDocument } from "@/lib/firestore-helpers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";
import { labelForCategory, parseLocalDay } from "@/lib/billing-utils";
import { CATEGORY_OPTIONS } from "@/config/billing/categories";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface DocumentsTableProps {
  documents: BillDocument[];
  showAmounts: boolean;
  onDeleteComplete?: () => void;
}

export function DocumentsTable({
  documents,
  showAmounts,
  onDeleteComplete,
}: DocumentsTableProps) {
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

  const statusStyles = {
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
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
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
          <SelectTrigger className="w-[180px]">
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider / File</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Upload Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No documents found.
                </TableCell>
              </TableRow>
            ) : (
              filteredDocuments.map((doc) => {
                const dueDate = parseLocalDay(doc.dueDate);
                return (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">
                          {doc.providerNameDetected ||
                            doc.provider ||
                            doc.fileName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {labelForCategory(doc.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(doc.uploadedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dueDate ? formatDate(dueDate) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(doc.amount ?? doc.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusStyles[doc.status]}
                      >
                        {doc.status === "needs_review" ? "Review" : doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmDelete(doc)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/documents/${doc.id}`}>
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                        {doc.storageUrl && (
                          <Button variant="ghost" size="icon" asChild>
                            <a
                              href={doc.storageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4">
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
