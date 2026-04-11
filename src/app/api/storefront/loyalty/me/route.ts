import { NextRequest, NextResponse } from "next/server";
import { getLoyaltySession } from "@/lib/loyalty-session";
import { loyaltyMemberService, loyaltyConfigService } from "@/services/loyalty";
import { tenantRepository } from "@/repositories/tenant.repository";

/**
 * GET /api/storefront/loyalty/me
 * Get current logged-in loyalty member from session cookie
 * Query params: tenantId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: "Tenant ID is required",
        },
        { status: 400 }
      );
    }

    // Get session from cookie
    const session = await getLoyaltySession(tenantId);

    if (!session) {
      return NextResponse.json({
        success: false,
        error: "Not logged in",
      });
    }

    // Verify tenant exists
    const tenant = await tenantRepository.getById(tenantId);
    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          error: "Tenant not found",
        },
        { status: 404 }
      );
    }

    // Get member data (fresh from database)
    const member = await loyaltyMemberService.getMember(tenantId, session.memberId);

    if (!member) {
      // Member was deleted, clear session would be handled by client
      return NextResponse.json({
        success: false,
        error: "Member not found",
      });
    }

    // Get loyalty config for pointsPerDollar
    const pointsPerDollar = await loyaltyConfigService.getPointsPerDollar(tenantId);

    return NextResponse.json({
      success: true,
      data: {
        member: {
          id: member.id,
          phone: member.phone,
          email: member.email,
          firstName: member.firstName,
          lastName: member.lastName,
          points: member.points,
        },
        pointsPerDollar,
      },
    });
  } catch (error) {
    console.error("[Loyalty Me] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred",
      },
      { status: 500 }
    );
  }
}
