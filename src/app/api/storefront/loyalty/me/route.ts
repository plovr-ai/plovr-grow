import { NextRequest, NextResponse } from "next/server";
import { getLoyaltySession } from "@/lib/loyalty-session";
import { loyaltyMemberService, loyaltyConfigService } from "@/services/loyalty";
import { companyRepository } from "@/repositories/company.repository";

/**
 * GET /api/storefront/loyalty/me
 * Get current logged-in loyalty member from session cookie
 * Query params: companyId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        {
          success: false,
          error: "Company ID is required",
        },
        { status: 400 }
      );
    }

    // Get session from cookie
    const session = await getLoyaltySession(companyId);

    if (!session) {
      return NextResponse.json({
        success: false,
        error: "Not logged in",
      });
    }

    // Get company to extract tenantId
    const company = await companyRepository.getById(companyId);
    if (!company) {
      return NextResponse.json(
        {
          success: false,
          error: "Company not found",
        },
        { status: 404 }
      );
    }

    const tenantId = company.tenantId;

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
    const pointsPerDollar = await loyaltyConfigService.getPointsPerDollar(
      tenantId,
      companyId
    );

    return NextResponse.json({
      success: true,
      data: {
        member: {
          id: member.id,
          phone: member.phone,
          name: member.name,
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
