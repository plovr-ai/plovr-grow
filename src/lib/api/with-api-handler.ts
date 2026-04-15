import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";

type RouteContext = { params: Promise<Record<string, string>> };
type ApiHandler = (
  req: NextRequest,
  context: RouteContext
) => Promise<NextResponse>;

export function withApiHandler(handler: ApiHandler): ApiHandler {
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

      console.error("Unhandled error:", error);
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.INTERNAL_ERROR } },
        { status: 500 }
      );
    }
  };
}
