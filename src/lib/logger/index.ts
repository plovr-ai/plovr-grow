import pino from "pino";
import type { NextRequest } from "next/server";

const isDev = process.env.NODE_ENV === "development";

export const logger = pino({
  level: isDev ? "debug" : "info",
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
  }),
});

/**
 * Create a child logger bound to a specific HTTP request.
 * Extracts or generates a requestId, and attaches method + path.
 */
export function createRequestLogger(req: NextRequest) {
  const requestId =
    req.headers?.get("x-request-id") ?? crypto.randomUUID();
  return logger.child({
    requestId,
    method: req.method,
    path: req.nextUrl?.pathname,
  });
}
