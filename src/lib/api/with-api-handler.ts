import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";

type RouteContext<T extends Record<string, string> = Record<string, string>> = {
  params: Promise<T>;
};

type ApiHandler<T extends Record<string, string> = Record<string, string>> = (
  req: NextRequest,
  context: RouteContext<T>
) => Promise<NextResponse>;

export function withApiHandler<
  T extends Record<string, string> = Record<string, string>,
>(handler: ApiHandler<T>): ApiHandler<T> {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              ...(error.params && { params: error.params }),
            },
          },
          { status: error.statusCode }
        );
      }

      // Extract request info for Sentry context.
      // Some callers (e.g. cron routes in tests) cast a plain Request
      // to NextRequest, so nextUrl may be unavailable.
      const pathname = req.nextUrl?.pathname ?? new URL(req.url).pathname;
      const pathSegments = pathname.split("/");
      const tenantIdx = pathSegments.indexOf("tenants");
      const tenantId =
        tenantIdx !== -1 ? pathSegments[tenantIdx + 1] : undefined;

      Sentry.setContext("request", {
        method: req.method,
        path: pathname,
        ...(tenantId && { tenantId }),
      });

      Sentry.captureException(error);

      console.error("Unhandled error:", error);
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.INTERNAL_ERROR } },
        { status: 500 }
      );
    }
  };
}
