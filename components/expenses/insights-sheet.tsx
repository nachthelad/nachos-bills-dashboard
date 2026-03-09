"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { ExpenseEntry } from "@/lib/expenses-client";
import type { IncomeEntry } from "@/lib/income-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check, Copy, Lightbulb, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface InsightsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ExpenseEntry[];
  incomeEntries: IncomeEntry[];
  monthLabel: string;
  monthFilter: string;
}

function formatMonthLabel(filter: string): string {
  if (filter === "all") return "todos los meses";
  const [year, month] = filter.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  const label = d.toLocaleString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute -bottom-5 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      aria-label="Copiar mensaje"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

export function InsightsSheet({
  open,
  onOpenChange,
  entries,
  incomeEntries,
  monthLabel,
  monthFilter,
}: InsightsSheetProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  const sendMessage = async (userContent?: string) => {
    if (!user || streaming) return;

    const newMessages: Message[] = userContent
      ? [...messages, { role: "user", content: userContent }]
      : messages;

    if (userContent) {
      setMessages(newMessages);
      setInput("");
    }

    setStreaming(true);
    const assistantPlaceholder: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantPlaceholder]);

    try {
      const token = await user.getIdToken();
      const serializedEntries = entries.map((e) => ({
        amount: e.amount,
        category: e.category,
        description: e.description,
        date: e.date.toISOString(),
      }));

      const serializedIncome = incomeEntries.map((e) => ({
        amount: e.amount,
        source: e.source,
        name: e.name,
        date: e.date.toISOString(),
      }));

      const res = await fetch("/api/expenses/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entries: serializedEntries,
          incomeEntries: serializedIncome,
          monthLabel,
          monthFilter,
          messages: newMessages,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to fetch insights");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }
    } catch (err) {
      console.error("Insights error:", err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Hubo un error al obtener los insights. Intentá de nuevo.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  };

  // Auto-trigger initial analysis when sheet opens
  useEffect(() => {
    if (open && !hasInitialized.current && entries.length > 0) {
      hasInitialized.current = true;
      sendMessage();
    }
    if (!open) {
      hasInitialized.current = false;
      setMessages([]);
      setInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || streaming) return;
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = input.trim();
      if (trimmed && !streaming) sendMessage(trimmed);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0" />
            <SheetTitle className="text-base">Tips & Tricks</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {monthLabel} · Análisis de gastos con IA
          </SheetDescription>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
          {messages.length === 0 && !streaming && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Cargando análisis...
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div className="relative group max-w-[85%]">
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {msg.content || (
                    <span className="opacity-50 animate-pulse">●●●</span>
                  )}
                </div>
                {msg.role === "assistant" && msg.content && (
                  <CopyButton text={msg.content} />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="border-t px-4 py-3 flex gap-2 items-end"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Preguntá algo sobre tus gastos..."
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[40px] max-h-[120px] disabled:opacity-50"
            rows={1}
            disabled={streaming}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || streaming}
            aria-label="Enviar mensaje"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
