import { NextRequest, NextResponse } from "next/server";
import { loyaltyService } from "@/services/loyalty";
import { merchantService } from "@/services/merchant";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phone = searchParams.get("phone");
    const companySlug = searchParams.get("companySlug");

    if (!phone || !companySlug) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: phone and companySlug",
        },
        { status: 400 }
      );
    }

    // Get company by slug
    const company = await merchantService.getCompanyBySlug(companySlug);
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

    // Get customer dashboard data
    const dashboard = await loyaltyService.getCustomerDashboard(
      tenantId,
      tenantId,
      phone
    );

    if (!dashboard.isEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: "Loyalty program is not enabled for this company",
        },
        { status: 400 }
      );
    }

    if (!dashboard.member) {
      return NextResponse.json(
        {
          success: false,
          error: "Loyalty member not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        member: {
          id: dashboard.member.id,
          phone: dashboard.member.phone,
          firstName: dashboard.member.firstName,
          lastName: dashboard.member.lastName,
          points: dashboard.member.points,
          totalOrders: dashboard.member.totalOrders,
          totalSpent: dashboard.member.totalSpent,
          enrolledAt: dashboard.member.enrolledAt,
        },
        config: dashboard.config
          ? {
              pointsPerDollar: dashboard.config.pointsPerDollar,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[Loyalty Status] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred while fetching loyalty status",
      },
      { status: 500 }
    );
  }
}
