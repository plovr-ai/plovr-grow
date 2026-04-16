import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateExternalRequest } from "@/lib/external-auth";
import { withApiHandler } from "@/lib/api";
import { merchantService } from "@/services/merchant";
import { menuService } from "@/services/menu";
import { ErrorCodes } from "@/lib/errors/error-codes";
import type { MerchantWithTenant } from "@/services/merchant";

const KNOWLEDGE_TARGETS = [
  "MENU",
  "OPENING_HOURS",
  "GREETINGS",
  "RESTAURANT_INFO",
  "SERVICE_PROVIDED",
  "FAQ",
  "ORDER_CONFIG",
  "AGENT_WORK_SWITCH",
] as const;

type KnowledgeTarget = (typeof KNOWLEDGE_TARGETS)[number];

const knowledgeQuerySchema = z.object({
  tenantId: z.string().min(1),
  merchantId: z.string().min(1),
  targets: z.array(z.enum(KNOWLEDGE_TARGETS)).min(1),
});

type KnowledgeEntry = { data: string } | null;

async function resolveTarget(
  target: KnowledgeTarget,
  merchant: MerchantWithTenant
): Promise<KnowledgeEntry> {
  switch (target) {
    case "RESTAURANT_INFO":
      return {
        data: JSON.stringify({
          name: merchant.name,
          address: merchant.address,
          city: merchant.city,
          state: merchant.state,
          zipCode: merchant.zipCode,
          phone: merchant.phone,
          email: merchant.email,
          timezone: merchant.timezone,
          currency: merchant.currency,
          locale: merchant.locale,
        }),
      };

    case "OPENING_HOURS":
      return {
        data: JSON.stringify(merchant.businessHours ?? {}),
      };

    case "ORDER_CONFIG":
      return {
        data: JSON.stringify(merchant.settings ?? {}),
      };

    case "MENU": {
      const menuData = await menuService.getMenu(
        merchant.tenantId,
        merchant.id
      );
      return { data: JSON.stringify(menuData) };
    }

    case "GREETINGS":
    case "FAQ":
    case "SERVICE_PROVIDED":
    case "AGENT_WORK_SWITCH":
      return null;
  }
}

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

  const parsed = knowledgeQuerySchema.safeParse(body);
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

  const { tenantId, merchantId, targets } = parsed.data;
  const merchant = await merchantService.getMerchantById(merchantId);

  if (!merchant || merchant.tenantId !== tenantId) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.MERCHANT_NOT_FOUND } },
      { status: 404 }
    );
  }

  const knowledgeMap: Record<string, KnowledgeEntry> = {};

  for (const target of targets) {
    knowledgeMap[target] = await resolveTarget(target, merchant);
  }

  return NextResponse.json({
    success: true,
    data: { knowledgeMap },
  });
});
