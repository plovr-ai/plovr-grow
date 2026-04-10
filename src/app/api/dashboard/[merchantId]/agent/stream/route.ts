import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { merchantRepository } from "@/repositories/merchant.repository";
import { dashboardAgentService } from "@/services/dashboard-agent";
import { subscriptionService } from "@/services/subscription";

export const dynamic = "force-dynamic";

/**
 * Request body schema
 */
const requestSchema = z.object({
  message: z.string().min(1).max(5000),
  conversationId: z.string().optional(),
  context: z
    .object({
      activeIntent: z
        .object({
          category: z.string(),
          action: z.string(),
          confidence: z.number(),
          entities: z.record(z.string(), z.unknown()),
        })
        .optional(),
      slots: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

/**
 * POST /api/dashboard/[merchantId]/agent/stream
 *
 * Streaming endpoint for agent conversations.
 * Returns Server-Sent Events (SSE) for real-time responses.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  const { merchantId } = await params;

  // Authentication check
  const session = await auth();
  if (!session?.user?.id || !session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get merchant with company info and verify access
  const merchant = await merchantRepository.getByIdWithCompany(merchantId);
  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  // Verify the merchant belongs to the user's tenant
  if (merchant.company.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = requestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { message, conversationId, context } = validation.data;
  const tenantId = merchant.company.tenantId;
  const userId = session.user.id;

  // Fetch subscription status server-side (secure)
  const subscription = await subscriptionService.getSubscriptionForDashboard(tenantId);

  // Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = dashboardAgentService.processMessageStream(
          tenantId,
          tenantId,
          merchantId,
          userId,
          {
            message,
            conversationId,
            context: {
              activeIntent: context?.activeIntent as import("@/services/dashboard-agent").IntentResult | undefined,
              slots: context?.slots || {},
              subscription: subscription
                ? {
                    status: subscription.status,
                    canAccessPremiumFeatures: subscription.canAccessPremiumFeatures,
                    isTrialing: subscription.isTrialing,
                    trialDaysRemaining: subscription.trialDaysRemaining,
                  }
                : undefined,
            },
          }
        );

        for await (const event of generator) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (error) {
        const errorData = `data: ${JSON.stringify({
          type: "error",
          data: error instanceof Error ? error.message : "Unknown error",
        })}\n\n`;
        controller.enqueue(encoder.encode(errorData));

        const doneData = `data: ${JSON.stringify({ type: "done", data: null })}\n\n`;
        controller.enqueue(encoder.encode(doneData));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
