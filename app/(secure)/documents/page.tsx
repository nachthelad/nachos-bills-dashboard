"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useMemo, useState } from "react"
import type { BillDocument } from "@/lib/firestore-helpers"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { FileText, PenSquare } from "lucide-react"

export default function DocumentsPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<BillDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchDocuments = async () => {
      try {
        const token = await user.getIdToken()
        const response = await fetch("/api/documents", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error ?? "Failed to load documents")
        }

        const data = await response.json()
        const docs = (data.documents as BillDocument[]).map((doc) => ({
          ...doc,
          uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
        }))

        setDocuments(docs)
      } catch (error) {
        console.error("Error fetching documents:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchDocuments()
  }, [user])

  const groupedDocuments = useMemo(() => {
    const groups = new Map<string, BillDocument[]>()

    documents.forEach((doc) => {
      const key = doc.category?.trim() || "Uncategorized"
      const group = groups.get(key)
      if (group) {
        group.push(doc)
      } else {
        groups.set(key, [doc])
      }
    })

    return Array.from(groups.entries())
      .map(([category, docs]) => ({
        category,
        documents: [...docs].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()),
      }))
      .sort((a, b) => {
        if (b.documents.length === a.documents.length) {
          return a.category.localeCompare(b.category)
        }
        return b.documents.length - a.documents.length
      })
  }, [documents])

  const pendingCount = documents.filter((doc) => doc.status === "pending").length
  const reviewCount = documents.filter((doc) => doc.status === "needs_review").length
  const parsedAmount = documents.reduce((total, doc) => {
    const amount = doc.amount ?? doc.totalAmount
    if (!amount) return total
    return total + amount
  }, 0)

  const visibleGroups = useMemo(() => {
    if (!selectedCategory) return groupedDocuments
    return groupedDocuments.filter((group) => group.category === selectedCategory)
  }, [groupedDocuments, selectedCategory])

  const categoryOptions = useMemo(() => groupedDocuments.map((group) => group.category), [groupedDocuments])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading documents...</div>
      </div>
    )
  }

  const statusColorMap: Record<BillDocument["status"], string> = {
    pending: "text-amber-400 bg-amber-500/10",
    parsed: "text-emerald-400 bg-emerald-500/10",
    needs_review: "text-amber-300 bg-amber-300/10",
    error: "text-red-400 bg-red-500/10",
  }

  return (
    <div className="p-6 lg:p-8 bg-slate-950 text-slate-100 min-h-screen space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-slate-500">Library</p>
        <h1 className="text-3xl font-bold">Documents</h1>
        <p className="text-slate-400 mt-2">View and manage your uploaded bills.</p>
      </div>

      {documents.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-500">Total documents</p>
                <p className="text-3xl font-semibold mt-2">{documents.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-500">Waiting to parse</p>
                <p className="text-3xl font-semibold mt-2">{pendingCount}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-500">Needs review</p>
                <p className="text-3xl font-semibold mt-2">{reviewCount}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-500">Parsed amount</p>
                <p className="text-3xl font-semibold mt-2">
                  {parsedAmount > 0 ? `ARS ${parsedAmount.toLocaleString("es-AR")}` : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {categoryOptions.length > 1 && (
            <div className="flex gap-2 flex-wrap items-center">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  selectedCategory === null
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                All
              </button>
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    selectedCategory === category
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {documents.length === 0 ? (
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="pt-12 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="mb-4">No documents yet.</p>
            <Link href="/upload">
              <Button className="bg-emerald-500 text-slate-900 hover:bg-emerald-400">Upload Your First Bill</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {visibleGroups.map(({ category, documents: docs }) => (
            <section key={category} className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Category</p>
                  <h2 className="text-2xl font-semibold text-slate-50">{category}</h2>
                </div>
                <div className="text-sm text-slate-400">
                  {docs.length} document{docs.length > 1 ? "s" : ""} · {docs.filter((doc) => doc.status === "pending").length}{" "}
                  pending · {docs.filter((doc) => doc.status === "needs_review").length} to review
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {docs.map((doc) => (
                  <Link key={doc.id} href={`/documents/${doc.id}`} className="group">
                    <Card className="cursor-pointer transition border-slate-800 bg-slate-900/60 group-hover:border-slate-700">
                      <CardContent className="px-3 py-2 space-y-1.5">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-slate-800/80 p-1.5 text-slate-200 shrink-0">
                            {doc.manualEntry ? <PenSquare className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-100 truncate">
                              {doc.providerNameDetected ?? doc.provider ?? doc.fileName ?? "—"}
                            </p>
                            <span className="text-xs text-slate-500 whitespace-nowrap">
                              {doc.uploadedAt.toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-50 whitespace-nowrap">
                            {doc.amount ?? doc.totalAmount
                              ? `ARS ${(doc.amount ?? doc.totalAmount)?.toLocaleString("es-AR")}`
                              : "—"}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 gap-2">
                          <p className="truncate">
                            Due <span className="text-slate-200">{doc.dueDate ?? "—"}</span>
                          </p>
                          <p className="truncate text-center">
                            Period{" "}
                            <span className="text-slate-200">
                              {doc.periodEnd
                                ? doc.periodStart
                                  ? `${doc.periodStart} – ${doc.periodEnd}`
                                  : doc.periodEnd
                                : "—"}
                            </span>
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize shrink-0 ${statusColorMap[doc.status]}`}
                          >
                            {doc.status.replace("_", " ")}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
