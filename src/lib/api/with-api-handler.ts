import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";
import { createRequestLogger } from "@/lib/logger";

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
    const reqLogger = createRequestLogger(req);
    const start = Date.now();

    try {
      const response = await handler(req, context);
      const duration = Date.now() - start;
      reqLogger.info({ duration, status: response.status }, "Request completed");
      return response;
    } catch (error) {
      const duration = Date.now() - start;

      if (error instanceof AppError) {
        reqLogger.warn(
          { err: error, code: error.code, status: error.statusCode, duration },
          "App error"
        );
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

      reqLogger.error({ err: error, duration }, "Unhandled error");
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.INTERNAL_ERROR } },
        { status: 500 }
      );
    }
  };
}
