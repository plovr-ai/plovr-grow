import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateExternalRequest } from "@/lib/external-auth";
import { withApiHandler } from "@/lib/api";
import { smsService } from "@/services/sms/sms.service";
import { ErrorCodes } from "@/lib/errors/error-codes";

const sendSmsSchema = z.object({
  tenantId: z.string().min(1),
  merchantId: z.string().min(1),
  mobile: z.string().min(1),
  message: z.string().min(1).max(1600),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const caller = await validateExternalRequest(request);
  if (!caller.authenticated) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.VALIDATION_FAILED } },
      { status: 400 }
    );
  }

  const parsed = sendSmsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.VALIDATION_FAILED },
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { mobile, message } = parsed.data;
  const result = await smsService.sendMessage(mobile, message);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { messageId: result.messageId },
  });
});
