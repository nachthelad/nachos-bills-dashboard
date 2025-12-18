"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState, useRef } from "react";
import type { BillDocument } from "@/lib/firestore-helpers";
import { createApiClient } from "@/lib/api-client";
import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";
import { DocumentsTable } from "@/components/bills/documents-table";
import { MobileDocumentsList } from "@/components/bills/mobile-documents-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Plus,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useBillUpload } from "@/hooks/use-bill-upload";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner"; // Assuming sonner is used, or I'll use a local alert if not sure.
// Checking previous file content... it didn't use toast. I'll stick to local UI feedback for now to avoid dependency issues,
// or I can see if the project uses a toast library.
// Standard in these stacks (shadcn/ui) is usually sonner or use-toast.
// I'll stick to a floating status indicator for now as per plan "toast or a small floating indicator"

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<BillDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const { showAmounts } = useAmountVisibility();
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiClient = useMemo(() => {
    if (!user) return null;
    return createApiClient({ getToken: () => user.getIdToken() });
  }, [user]);

  const fetchDocuments = () => {
    if (!user || !apiClient) return;
    setLoadingDocs(true);
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
        setLoadingDocs(false);
      });
  };

  const { upload, isUploading, progress, error, reset } =
    useBillUpload(fetchDocuments);

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

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Check if we're actually leaving the container, not just entering a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await upload(file);
    }
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      await upload(file);
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (loadingDocs && documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading documents...</div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-[calc(100vh-100px)]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl">
          <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
            <div className="p-4 bg-primary/10 rounded-full">
              <Upload className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-foreground">
              Drop file to upload
            </h3>
            <p className="text-muted-foreground">PDF, PNG, JPG supported</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Library
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold mr-auto">Documents</h1>
              <AmountVisibilityToggle />

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileInputChange}
                  accept=".pdf,.png,.jpg,.jpeg,.heic,.heif,.webp,.tif,.tiff,image/*"
                />
                <Button
                  disabled={isUploading}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Upload File
                </Button>

                <Button
                  asChild
                  variant="default"
                  size="sm"
                  className="gap-2"
                  disabled={isUploading}
                >
                  <Link href="/upload">
                    <Plus className="w-4 h-4" />
                    Add manually
                  </Link>
                </Button>
              </div>
            </div>
          </div>
          <p className="text-muted-foreground">
            View and manage your uploaded bills. Drag and drop files anywhere on
            this page to upload.
          </p>
        </div>

        {/* Upload Status Card - Floating or Fixed */}
        {(isUploading || error) && (
          <div className="w-full bg-muted/50 border rounded-lg p-4 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-background border rounded-md">
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-destructive" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-sm font-medium">
                  <span>
                    {isUploading ? "Uploading file..." : "Upload failed"}
                  </span>
                  {isUploading && <span>{progress}%</span>}
                </div>
                {isUploading ? (
                  <Progress value={progress} className="h-1" />
                ) : (
                  <p className="text-xs text-destructive">{error}</p>
                )}
              </div>
              {!isUploading && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="w-full">
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
