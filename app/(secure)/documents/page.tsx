"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import type { BillDocument } from "@/lib/firestore-helpers";
import { createApiClient } from "@/lib/api-client";
import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";
import { UploadPanel } from "@/components/bills/upload-panel";
import { DocumentsTable } from "@/components/bills/documents-table";
import { MobileDocumentsList } from "@/components/bills/mobile-documents-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<BillDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const { showAmounts } = useAmountVisibility();

  const apiClient = useMemo(() => {
    if (!user) return null;
    return createApiClient({ getToken: () => user.getIdToken() });
  }, [user]);

  const fetchDocuments = () => {
    if (!user || !apiClient) return;
    setLoading(true);
    apiClient
      .listDocuments()
      .then((docs) => {
        const sortedDocs = docs.sort((a, b) => {
          const dateA = a.dueDate
            ? new Date(a.dueDate).getTime()
            : a.uploadedAt.getTime();
          const dateB = b.dueDate
            ? new Date(b.dueDate).getTime()
            : b.uploadedAt.getTime();
          return dateB - dateA;
        });
        setDocuments(sortedDocs);
      })
      .catch((error) => {
        console.error("Error fetching documents:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDocuments();
  }, [apiClient, user]);

  // Auto-refresh for pending documents
  useEffect(() => {
    const hasPendingDocs = documents.some((doc) => doc.status === "pending");
    if (!hasPendingDocs) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 5000);

    return () => clearInterval(interval);
  }, [documents, apiClient, user]);

  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Library
          </p>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Documents</h1>
            <AmountVisibilityToggle />
            <Button asChild variant="outline" size="sm" className="ml-2 gap-2">
              <Link href="/upload">
                <Upload className="w-4 h-4" />
                Add manually
              </Link>
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground">
          View and manage your uploaded bills.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <UploadPanel onUploadComplete={fetchDocuments} />
        </div>
        <div className="xl:col-span-2">
          <div className="hidden md:block">
            <DocumentsTable
              documents={documents}
              showAmounts={showAmounts}
              onDeleteComplete={fetchDocuments}
            />
          </div>
          <div className="md:hidden">
            <MobileDocumentsList
              documents={documents}
              showAmounts={showAmounts}
              onDeleteComplete={fetchDocuments}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
