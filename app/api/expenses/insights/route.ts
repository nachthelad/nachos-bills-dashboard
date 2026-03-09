import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import { getAdminFirestore } from "@/lib/firebase-admin";

interface ExpenseEntry {
  amount: number;
  category: string;
  description: string;
  date: string;
}

interface IncomeEntry {
  amount: number;
  source: string;
  name: string;
  date: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request);

    const { entries, incomeEntries = [], monthLabel, monthFilter, messages } = (await request.json()) as {
      entries: ExpenseEntry[];
      incomeEntries: IncomeEntry[];
      monthLabel: string;
      monthFilter: string;
      messages: Message[];
    };

    const db = getAdminFirestore();

    // Fetch bills for the month
    const billsSnap = await db.collection("documents").where("userId", "==", uid).get();
    const bills = billsSnap.docs
      .map((doc) => doc.data() as Record<string, unknown>)
      .filter((d) => {
        if (!monthFilter || monthFilter === "all") return true;
        const raw = d.dueDate ?? d.issueDate ?? d.periodStart ?? "";
        const dateStr = raw && typeof (raw as any).toDate === "function"
          ? ((raw as any).toDate() as Date).toISOString()
          : String(raw);
        return dateStr.startsWith(monthFilter);
      })
      .filter((d) => d.category !== "hoa" && typeof d.totalAmount === "number" && (d.totalAmount as number) > 0);

    // Fetch HOA summaries for the month
    const hoaSnap = await db.collection("hoaSummaries").where("userId", "==", uid).get();
    const hoaSummaries = hoaSnap.docs
      .map((doc) => doc.data() as Record<string, unknown>)
      .filter((d) => !monthFilter || monthFilter === "all" || d.periodKey === monthFilter);

    const positiveEntries = entries.filter((e) => e.amount > 0);
    const totalExpenses = positiveEntries.reduce((sum, e) => sum + e.amount, 0);
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();
    const dailyAvg = daysInMonth > 0 ? totalExpenses / daysInMonth : 0;

    const categoryTotals: Record<string, number> = {};
    positiveEntries.forEach((e) => {
      categoryTotals[e.category] =
        (categoryTotals[e.category] ?? 0) + e.amount;
    });

    const categoryBreakdown = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, amt]) => `  - ${cat}: $${Math.round(amt).toLocaleString("es-AR")}`)
      .join("\n");

    // Bills breakdown
    const totalBills = bills.reduce((sum, d) => sum + ((d.totalAmount as number) ?? 0), 0);
    const billsBreakdown = bills.length > 0
      ? bills
          .map((d) => `  - ${(d.providerNameDetected ?? d.provider ?? d.fileName) as string}: $${Math.round((d.totalAmount as number)).toLocaleString("es-AR")}`)
          .join("\n")
      : "  (sin facturas registradas este mes)";

    // HOA breakdown
    const totalHoa = hoaSummaries.reduce((sum, d) => sum + ((d.totalToPayUnit as number) ?? 0), 0);
    const hoaBreakdown = hoaSummaries.length > 0
      ? hoaSummaries
          .map((d) => `  - Expensas (${(d.periodLabel ?? d.periodKey) as string}): $${Math.round((d.totalToPayUnit as number) ?? 0).toLocaleString("es-AR")}`)
          .join("\n")
      : "  (sin expensas registradas este mes)";

    const totalAllExpenses = totalExpenses + totalBills + totalHoa;
    const totalIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
    const balance = totalIncome - totalAllExpenses;
    const savingsRate = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : null;

    const incomeBreakdown = incomeEntries.length > 0
      ? incomeEntries
          .map((e) => `  - ${e.name} (${e.source}): $${Math.round(e.amount).toLocaleString("es-AR")}`)
          .join("\n")
      : "  (sin ingresos registrados este mes)";

    const balanceLine = totalIncome > 0
      ? `- Balance real (ingresos - todos los gastos): $${Math.round(balance).toLocaleString("es-AR")} (ahorro ${savingsRate}%)`
      : "";

    const systemPrompt = `Sos un asesor financiero personal que analiza gastos e ingresos mensuales en pesos argentinos. Dá consejos prácticos, concretos y directos en español rioplatense. Sé conciso y útil. Usá formato simple sin markdown excesivo.

Datos del mes (${monthLabel}):
Ingresos:
- Total ingresos: $${Math.round(totalIncome).toLocaleString("es-AR")}
- Por fuente:
${incomeBreakdown}

Gastos del día a día (Expenses):
- Total: $${Math.round(totalExpenses).toLocaleString("es-AR")}
- Promedio diario: $${Math.round(dailyAvg).toLocaleString("es-AR")}
- Por categoría:
${categoryBreakdown || "  (sin datos)"}

Facturas/Servicios (Bills):
- Total: $${Math.round(totalBills).toLocaleString("es-AR")}
${billsBreakdown}

Expensas (HOA):
- Total: $${Math.round(totalHoa).toLocaleString("es-AR")}
${hoaBreakdown}

- TOTAL GENERAL GASTADO: $${Math.round(totalAllExpenses).toLocaleString("es-AR")}
${balanceLine}

Al dar el análisis inicial, considerá TODOS los gastos (expenses + bills + expensas). Si hay datos de ingresos, analizá la tasa de ahorro real. Listá 3-5 observaciones clave y tips concretos. Para preguntas de seguimiento, respondé en contexto con los datos del mes.`;

    const chatMessages = messages.length > 0
      ? messages
      : [{ role: "user", content: "Analizá mis gastos de este mes y dame tips concretos para mejorar." }];

    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...chatMessages,
    ];

    const MODELS = ["gpt-4.1-nano", "gpt-5-mini"];
    const openaiHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
    };

    let openaiRes: Response | null = null;
    for (const model of MODELS) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: openaiHeaders,
        body: JSON.stringify({ model, max_tokens: 1024, messages: openaiMessages, stream: true }),
      });
      if (res.ok) {
        openaiRes = res;
        break;
      }
      const errorText = await res.text();
      if (res.status === 404 || errorText.includes("model_not_found")) {
        console.warn(`Model ${model} not available, trying next...`);
        continue;
      }
      console.error("OpenAI API error:", errorText);
      return NextResponse.json({ error: "Failed to get insights from AI" }, { status: 500 });
    }

    if (!openaiRes) {
      return NextResponse.json({ error: "No available model found" }, { status: 500 });
    }

    // Transform OpenAI SSE stream to plain text chunks
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openaiRes.body!.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content;
                if (text) {
                  controller.enqueue(new TextEncoder().encode(text));
                }
              } catch {
                // ignore malformed SSE lines
              }
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Insights route error:", error);
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return NextResponse.json(
      { error: "Failed to get insights" },
      { status: 500 }
    );
  }
}
