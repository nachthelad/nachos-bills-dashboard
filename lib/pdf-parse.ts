import { inflateSync } from "node:zlib"

type PdfParseResult = {
  text: string
}

function decodeBuffer(buffer: Buffer): string {
  return buffer.toString("utf8")
}

function sanitizeText(text: string): string {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]+/g, " ")
}

function extractStreams(pdfBinary: string): Buffer[] {
  const streams: Buffer[] = []
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match: RegExpExecArray | null
  while ((match = streamRegex.exec(pdfBinary)) !== null) {
    const data = match[1]
    streams.push(Buffer.from(data, "binary"))
  }
  return streams
}

function tryInflate(buffer: Buffer): Buffer {
  try {
    return inflateSync(buffer)
  } catch (error) {
    return buffer
  }
}

async function pdfParse(buffer: Buffer): Promise<PdfParseResult> {
  const binary = buffer.toString("binary")
  const streams = extractStreams(binary)

  const texts = streams
    .map((stream) => {
      const inflated = tryInflate(stream)
      return sanitizeText(decodeBuffer(inflated))
    })
    .filter((text) => text.trim().length > 0)

  const combined = texts.join("\n")
  if (combined.trim().length > 0) {
    return { text: combined }
  }

  return { text: sanitizeText(decodeBuffer(buffer)) }
}

export default pdfParse
