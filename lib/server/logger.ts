import { randomUUID } from "node:crypto"
import type { NextRequest } from "next/server"

export type LogLevel = "debug" | "info" | "warn" | "error"

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const envLevel = (process.env.LOG_LEVEL ?? process.env.NEXT_PUBLIC_LOG_LEVEL ?? "")
  .toLowerCase()
  .trim() as LogLevel

const DEFAULT_LEVEL: LogLevel = envLevel && LOG_LEVEL_PRIORITY[envLevel] ? envLevel : process.env.NODE_ENV === "production" ? "info" : "debug"

export type LogContext = {
  requestId?: string
  userId?: string
  route?: string
  [key: string]: unknown
}

export type LogMetadata = Record<string, unknown> & {
  error?: unknown
}

export type SerializedError = {
  name?: string
  message?: string
  stack?: string
  [key: string]: unknown
}

export type LogEntry = {
  level: LogLevel
  message: string
  timestamp: string
  requestId?: string
  userId?: string
  context?: Record<string, unknown>
  metadata?: Record<string, unknown>
  error?: SerializedError
}

export type LoggerTransport = (entry: LogEntry) => void | Promise<void>

function normalizeError(error: unknown): SerializedError | undefined {
  if (!error) {
    return undefined
  }
  if (error instanceof Error) {
    const serialized: SerializedError = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
    const extraKeys = ["code", "status", "statusText", "response"]
    for (const key of extraKeys) {
      const value = (error as Record<string, unknown>)[key]
      if (value !== undefined) {
        serialized[key] = value as unknown
      }
    }
    return serialized
  }
  if (typeof error === "string") {
    return { message: error }
  }
  if (typeof error === "object") {
    return { ...(error as Record<string, unknown>) }
  }
  return { message: String(error) }
}

const consoleTransport: LoggerTransport = (entry) => {
  const { level, message, requestId, userId, metadata, error, context } = entry
  const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : level === "info" ? console.info : console.debug
  consoleMethod(
    `[${entry.timestamp}] [${level.toUpperCase()}] ${message}`,
    {
      requestId,
      userId,
      context,
      metadata,
      error,
    },
  )
}

const logflareSourceId = process.env.LOGFLARE_SOURCE_ID
const logflareApiKey = process.env.LOGFLARE_API_KEY
const logflareEndpoint = process.env.LOGFLARE_API_URL ?? "https://api.logflare.app/logs"

const logflareTransport: LoggerTransport | null =
  logflareSourceId && logflareApiKey
    ? async (entry) => {
        try {
          if (typeof fetch !== "function") {
            return
          }
          await fetch(logflareEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-KEY": logflareApiKey,
            },
            body: JSON.stringify({
              source: logflareSourceId,
              message: entry.message,
              metadata: entry,
            }),
          })
        } catch (transportError) {
          console.warn("Failed to send log to Logflare", transportError)
        }
      }
    : null

const defaultTransports: LoggerTransport[] = logflareTransport ? [consoleTransport, logflareTransport] : [consoleTransport]

export class Logger {
  constructor(
    private readonly context: LogContext = {},
    private readonly level: LogLevel = DEFAULT_LEVEL,
    private readonly transports: LoggerTransport[] = defaultTransports,
  ) {}

  debug(message: string, metadata?: LogMetadata) {
    this.log("debug", message, metadata)
  }

  info(message: string, metadata?: LogMetadata) {
    this.log("info", message, metadata)
  }

  warn(message: string, metadata?: LogMetadata) {
    this.log("warn", message, metadata)
  }

  error(message: string, metadata?: LogMetadata) {
    this.log("error", message, metadata)
  }

  withContext(context: LogContext) {
    return new Logger({ ...this.context, ...context }, this.level, this.transports)
  }

  private log(level: LogLevel, message: string, metadata?: LogMetadata) {
    if (!this.shouldLog(level)) {
      return
    }
    const { error, ...restMetadata } = metadata ?? {}
    const { requestId, userId, ...context } = this.context
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId,
      userId,
      context: Object.keys(context).length > 0 ? context : undefined,
      metadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined,
      error: normalizeError(error),
    }
    for (const transport of this.transports) {
      try {
        const result = transport(entry)
        if (result && typeof (result as Promise<unknown>).then === "function") {
          ;(result as Promise<void>).catch((transportError) => {
            console.warn("Logger transport failed", transportError)
          })
        }
      } catch (transportError) {
        console.warn("Logger transport failed", transportError)
      }
    }
  }

  private shouldLog(level: LogLevel) {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level]
  }
}

export const logger = new Logger()

export function createRequestLogger(options?: {
  request?: Request | NextRequest | null
  userId?: string | null
  context?: LogContext
}): Logger {
  const baseRequestId = options?.request?.headers?.get?.("x-request-id") ?? undefined
  const requestId = baseRequestId || randomUUID()
  const userId = options?.userId ?? undefined
  const context = options?.context ?? {}
  return logger.withContext({ ...context, requestId, userId })
}
