import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { onboardingAgentService } from "@/services/onboarding-agent";
import { merchantService } from "@/services/merchant";

interface RouteParams {
  params: Promise<{ merchantId: string }>;
}

// Validation schemas
const importSourceSchema = z.object({
  type: z.enum(["website", "doordash", "ubereats", "google_business"]),
  url: z.string().url("Invalid URL format"),
  priority: z.number().int().min(1).max(10).optional(),
});

const importRequestSchema = z.object({
  sources: z
    .array(importSourceSchema)
    .min(1, "At least one source is required")
    .max(4, "Maximum 4 sources allowed"),
  options: z
    .object({
      createMenu: z.boolean().optional(),
      updateMerchant: z.boolean().optional(),
      updateCompany: z.boolean().optional(),
      menuName: z.string().min(1).max(100).optional(),
    })
    .optional(),
});

/**
 * POST: Import data from external sources
 *
 * Request body:
 * {
 *   sources: [
 *     { type: "website", url: "https://example.com", priority?: 10 },
 *     { type: "doordash", url: "https://doordash.com/store/...", priority?: 5 }
 *   ],
 *   options?: {
 *     createMenu?: boolean,      // default: true
 *     updateMerchant?: boolean,  // default: true
 *     updateCompany?: boolean,   // default: false
 *     menuName?: string          // default: "Imported Menu"
 *   }
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     sources: [{ type, url, status, extractedCategories?, extractedItems?, error? }],
 *     created: {
 *       menuId?: string,
 *       categories: [{ id, name }],
 *       items: [{ id, name, categoryId }],
 *       merchantUpdated: boolean,
 *       companyUpdated: boolean
 *     },
 *     warnings: string[],
 *     duration: number
 *   }
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { merchantId } = await params;
    const body = await request.json();

    // Validate input
    const validation = importRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    // Get merchant to find tenant and company
    const merchant = await merchantService.getMerchantById(merchantId);
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: "Merchant not found" },
        { status: 404 }
      );
    }

    const tenantId = merchant.company.tenantId;
    const companyId = merchant.company.id;
    const input = validation.data;

    console.log(
      `[Onboarding Import] Starting import for merchant ${merchantId} with ${input.sources.length} source(s)`
    );

    // Perform import
    const result = await onboardingAgentService.importFromSources(
      tenantId,
      companyId,
      merchantId,
      input.sources,
      input.options
    );

    console.log(
      `[Onboarding Import] Import completed: success=${result.success}, duration=${result.duration}ms`
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Import failed",
          data: result,
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error("[Onboarding Import] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
