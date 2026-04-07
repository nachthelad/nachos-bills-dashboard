/**
 * Debug: compares pdf2json vs pdf-parse text extraction on a bill PDF,
 * and shows what dates/keywords are found.
 * Usage: npx tsx scripts/debug-extract.mts <path-to-pdf>
 */
import fs from "node:fs";
import path from "node:path";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/debug-extract.mts <path-to-pdf>");
  process.exit(1);
}

const pdfBuffer = fs.readFileSync(filePath);
console.log(`\n=== FILE: ${path.basename(filePath)} (${pdfBuffer.length} bytes) ===\n`);

// ── pdf-parse ──────────────────────────────────────────────────────────────
const pdfParseModule = await import("pdf-parse");
const pdfParseFn = (pdfParseModule as any).default ?? pdfParseModule;
const pdfParseResult = await pdfParseFn(pdfBuffer);
const pdfParseText: string = pdfParseResult?.text ?? "";

// ── pdf2json ───────────────────────────────────────────────────────────────
type Pdf2JsonDoc = { Pages?: { Texts?: { R?: { T?: string }[] }[] }[] };
const mod = (await import("pdf2json")) as any;
const PDFParser = mod?.default ?? mod?.PDFParser ?? mod;
const decodeTok = (v: unknown) => {
  if (typeof v !== "string") return "";
  try { return decodeURIComponent(v); } catch { return v; }
};
const pdf2jsonText: string = await new Promise((resolve, reject) => {
  const p = new PDFParser();
  p.on("pdfParser_dataError", (e: any) => reject(e?.parserError ?? e));
  p.on("pdfParser_dataReady", (data: Pdf2JsonDoc) => {
    const chunks = (data?.Pages ?? []).map((page) => {
      const line = (page?.Texts ?? [])
        .map((t) => (t?.R ?? []).map((r) => decodeTok(r?.T)).join(""))
        .join(" ");
      return line.replace(/\s+/g, " ").trim();
    }).filter(Boolean);
    resolve(chunks.join("\n"));
  });
  p.parseBuffer(pdfBuffer);
});

// ── helpers ────────────────────────────────────────────────────────────────
const DATE_RE_STRICT = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g;
const DATE_RE_SPACED = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/g;
const KEYWORD_RE = /venc|vto\b|emisi[oó]n|emitida|fecha\s*:|cesp/i;

function analyze(label: string, text: string) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`${label}`);
  console.log(`${"─".repeat(70)}`);
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  console.log(`Lines: ${lines.length}  |  Chars: ${text.length}\n`);

  console.log("── Lines matching keywords:");
  lines.forEach((line, i) => {
    if (KEYWORD_RE.test(line)) {
      console.log(`  [${String(i).padStart(3, "0")}] ${line.slice(0, 120)}`);
    }
  });

  console.log("\n── Dates found (strict — no spaces around /):");
  for (const m of text.matchAll(DATE_RE_STRICT)) {
    const lineIdx = text.slice(0, m.index).split("\n").length - 1;
    const ctx = text.slice(Math.max(0, m.index! - 30), m.index! + 20).replace(/\n/g, "↵");
    console.log(`  ${m[0].padEnd(12)} line ${lineIdx}  ctx: ...${ctx}...`);
  }

  console.log("\n── Extra dates found with spaced regex (\\d\\s*/\\s*\\d\\s*/\\s*\\d):");
  const strictSet = new Set([...text.matchAll(DATE_RE_STRICT)].map(m => m[0]));
  for (const m of text.matchAll(DATE_RE_SPACED)) {
    if (!strictSet.has(m[0])) {
      const lineIdx = text.slice(0, m.index).split("\n").length - 1;
      const ctx = text.slice(Math.max(0, m.index! - 30), m.index! + 20).replace(/\n/g, "↵");
      console.log(`  "${m[0]}"  line ${lineIdx}  ctx: ...${ctx}...`);
    }
  }
}

analyze("pdf-parse", pdfParseText);
analyze("pdf2json", pdf2jsonText);
