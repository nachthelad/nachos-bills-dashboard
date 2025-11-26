"use client";

import type React from "react";

import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { uploadBillFile } from "@/lib/storage-helpers";
import type { BillDocument } from "@/lib/firestore-helpers";
import { Button } from "@/components/ui/button";
import { CATEGORY_OPTIONS } from "@/config/billing/categories";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronLeft, Upload } from "lucide-react";
import { FirebaseClientInitializationError } from "@/lib/firebase";
import { FirebaseError } from "firebase/app";
import {
  describeAllowedFileTypes,
  formatMaxUploadSize,
  validateUploadConstraints,
} from "@/lib/upload-constraints";
import { createApiClient, type CreateDocumentInput } from "@/lib/api-client";

export default function UploadPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<Partial<BillDocument>>({
    provider: "",
    amount: undefined,
    dueDate: "",
    periodStart: "",
    periodEnd: "",
    issueDate: "",
    category: CATEGORY_OPTIONS[0]?.value ?? "other",
    currency: "ARS",
  });

  const uploadRequirementsCopy = `${describeAllowedFileTypes()} up to ${formatMaxUploadSize()}.`;

  const apiClient = useMemo(() => {
    if (!user) return null;
    return createApiClient({ getToken: () => user.getIdToken() });
  }, [user]);

  const validateFile = useCallback((selectedFile?: File) => {
    if (!selectedFile) {
      setFile(null);
      return;
    }
    const validation = validateUploadConstraints({
      size: selectedFile.size,
      type: selectedFile.type,
      name: selectedFile.name,
    });
    if (!validation.ok) {
      setFile(null);
      setError(validation.message);
      return;
    }
    setFile(selectedFile);
    setError(null);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    validateFile(selectedFile);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const droppedFile = event.dataTransfer.files?.[0];
    validateFile(droppedFile);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleUpload = async () => {
    if (!file || !user || !apiClient) return;
    setLoading(true);
    setError(null);

    try {
      let storageUrl: string | null = null;

      const uploadViaApi = async () => {
        return apiClient.uploadFile(file, file.name);
      };

      const createDocumentViaApi = async (storageUrlValue: string) => {
        return apiClient.createDocument({
          fileName: file.name,
          storageUrl: storageUrlValue,
        });
      };

      try {
        storageUrl = await uploadBillFile(user.uid, file);
      } catch (uploadError) {
        const shouldFallback =
          uploadError instanceof FirebaseClientInitializationError ||
          (uploadError instanceof FirebaseError &&
            uploadError.code === "storage/unauthorized");

        if (!shouldFallback) {
          throw uploadError;
        }

        console.warn(
          "Client storage upload unavailable, falling back to server-side upload.",
          uploadError
        );
        storageUrl = await uploadViaApi();
      }

      if (!storageUrl) {
        throw new Error("Unable to upload file");
      }

      // Create document record via server
      const docId = await createDocumentViaApi(storageUrl);

      // Redirect immediately so the UI doesn't wait for parsing
      router.push("/documents");

      // Trigger parsing (call API route) - fire and forget
      void (async () => {
        try {
          await apiClient.triggerParse(docId);
        } catch (parseError) {
          console.warn("Parser request failed:", parseError);
        }
      })();
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!user || !apiClient) return;
    setManualLoading(true);
    setManualError(null);
    try {
      const payload: CreateDocumentInput = {
        fileName:
          manualForm.provider?.trim() || manualForm.category?.trim()
            ? `${
                manualForm.provider?.trim() || manualForm.category?.trim()
              } (manual)`
            : `Manual Bill ${new Date().toISOString().slice(0, 10)}`,
        storageUrl: null,
        provider: manualForm.provider?.trim() || null,
        category: manualForm.category || null,
        amount: manualForm.amount ?? null,
        currency: manualForm.currency || null,
        dueDate: manualForm.dueDate || null,
        issueDate: manualForm.issueDate || null,
        periodStart: manualForm.periodStart || null,
        periodEnd: manualForm.periodEnd || null,
        manualEntry: true,
        textExtract: null,
      };

      const documentId = await apiClient.createDocument(payload);
      router.push(`/documents/${documentId}`);
    } catch (err) {
      console.error("Manual doc error:", err);
      setManualError(
        err instanceof Error ? err.message : "Failed to save manual bill"
      );
    } finally {
      setManualLoading(false);
    }
  };

  const isManualValid =
    Boolean(manualForm.provider?.trim() || manualForm.category?.trim()) &&
    Boolean(manualForm.amount !== undefined && manualForm.amount !== null) &&
    Boolean(manualForm.dueDate);

  return (
    <div className="space-y-8">
      <Link
        href="/documents"
        className="flex items-center gap-2 text-emerald-300 hover:underline"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Documents
      </Link>

      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">
          Uploader
        </p>
        <h1 className="text-3xl font-bold">Upload Bill</h1>
        <p className="text-slate-400">
          Upload a bill or enter the details manually to track it in your
          dashboard.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-slate-900/70 border border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100">Select Bill File</CardTitle>
            <CardDescription className="text-slate-400">
              Upload PDF or image files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
                isDragActive
                  ? "border-emerald-400 bg-emerald-500/10"
                  : "border-slate-800 bg-slate-900/40"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-slate-500" />
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.heic,.heif,.webp,.tif,.tiff,image/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <span className="text-base font-semibold text-slate-100">
                  Click to select
                </span>
                {file && (
                  <p className="text-sm text-slate-400 mt-2">{file.name}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  or drag & drop here
                </p>
              </label>
            </div>

            <p className="text-sm text-slate-400">
              {uploadRequirementsCopy} Files are hashed before upload and
              scanned for malware when available.
            </p>

            {error && <div className="text-sm text-red-400">{error}</div>}

            <Button
              onClick={handleUpload}
              disabled={!file || loading}
              className="w-full bg-emerald-500 text-slate-900 hover:bg-emerald-400"
            >
              {loading ? "Uploading..." : "Upload Bill"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/70 border border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100">Add Manually</CardTitle>
            <CardDescription className="text-slate-400">
              Enter bill details if you don't have a file available.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <ManualInput
                label="Provider"
                value={manualForm.provider ?? ""}
                onChange={(value) =>
                  setManualForm((prev) => ({ ...prev, provider: value }))
                }
              />
              <ManualSelect
                label="Category"
                value={manualForm.category ?? ""}
                onChange={(value) =>
                  setManualForm((prev) => ({ ...prev, category: value }))
                }
              />
              <ManualInput
                label="Amount"
                type="number"
                value={manualForm.amount?.toString() ?? ""}
                onChange={(value) =>
                  setManualForm((prev) => ({
                    ...prev,
                    amount: value ? Number.parseFloat(value) : undefined,
                  }))
                }
              />
              <ManualInput
                label="Currency"
                value={manualForm.currency ?? "ARS"}
                onChange={(value) =>
                  setManualForm((prev) => ({
                    ...prev,
                    currency: value.toUpperCase(),
                  }))
                }
                placeholder="ARS"
              />
              <ManualInput
                label="Due Date"
                type="date"
                value={manualForm.dueDate ?? ""}
                onChange={(value) =>
                  setManualForm((prev) => ({ ...prev, dueDate: value }))
                }
              />
              <ManualInput
                label="Issue Date"
                type="date"
                value={manualForm.issueDate ?? ""}
                onChange={(value) =>
                  setManualForm((prev) => ({ ...prev, issueDate: value }))
                }
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ManualInput
                  label="Period Start"
                  type="date"
                  value={manualForm.periodStart ?? ""}
                  onChange={(value) =>
                    setManualForm((prev) => ({ ...prev, periodStart: value }))
                  }
                />
                <ManualInput
                  label="Period End"
                  type="date"
                  value={manualForm.periodEnd ?? ""}
                  onChange={(value) =>
                    setManualForm((prev) => ({ ...prev, periodEnd: value }))
                  }
                />
              </div>
            </div>

            {manualError && (
              <div className="text-sm text-red-400">{manualError}</div>
            )}

            <Button
              onClick={handleManualSubmit}
              disabled={!user || manualLoading || !isManualValid}
              className="w-full bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {manualLoading ? "Saving..." : "Save Manual Bill"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type ManualInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
};

function ManualInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: ManualInputProps) {
  return (
    <div>
      <label className="text-sm font-medium block mb-2 text-slate-200">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-800 rounded-md bg-slate-900/40 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      />
    </div>
  );
}

type ManualSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function ManualSelect({ label, value, onChange, disabled }: ManualSelectProps) {
  return (
    <div>
      <label className="text-sm font-medium block mb-2 text-slate-200">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-slate-800 rounded-md bg-slate-900/40 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
      >
        {CATEGORY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
