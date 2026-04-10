import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cateringOrderService } from "@/services/catering";
import { merchantService } from "@/services/merchant";
import type { CateringOrderItem } from "@/services/catering/catering-order.types";

interface RouteParams {
  params: Promise<{ merchantId: string }>;
}

// Validation schemas
const cateringOrderItemSchema = z.object({
  menuItemId: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  notes: z.string().optional(),
});

const createCateringOrderSchema = z.object({
  customerFirstName: z.string().min(1, "First name is required"),
  customerLastName: z.string().min(1, "Last name is required"),
  customerPhone: z.string().min(1, "Phone is required"),
  customerEmail: z.string().email("Invalid email"),
  eventDate: z.string().transform((str) => new Date(str)),
  eventTime: z.string().min(1, "Event time is required"),
  guestCount: z.number().int().positive("Guest count must be positive"),
  eventType: z.string().optional(),
  eventAddress: z.string().optional(),
  specialRequests: z.string().optional(),
  items: z.array(cateringOrderItemSchema).min(1, "At least one item is required"),
  subtotal: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  serviceCharge: z.number().nonnegative().optional(),
  totalAmount: z.number().nonnegative(),
  notes: z.string().optional(),
  leadId: z.string().optional(),
});

// GET: Get catering orders list
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { merchantId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);
    const search = searchParams.get("search") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Get merchant to find company and tenant
    const merchant = await merchantService.getMerchantById(merchantId);
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: "Merchant not found" },
        { status: 404 }
      );
    }

    const tenantId = merchant.company.tenantId;

    const result = await cateringOrderService.getCompanyOrders(
      tenantId,
      tenantId,
      {
        page,
        pageSize,
        search,
        status: status as "draft" | "sent" | "paid" | "completed" | "cancelled" | "all" | undefined,
        merchantId: searchParams.get("merchantId") ?? undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        orders: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        },
      },
    });
  } catch (error) {
    console.error("[Dashboard Catering Orders] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get catering orders" },
      { status: 500 }
    );
  }
}

// POST: Create a new catering order
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { merchantId } = await params;
    const body = await request.json();

    // Validate input
    const validation = createCateringOrderSchema.safeParse(body);
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

    // Get merchant to find tenant
    const merchant = await merchantService.getMerchantById(merchantId);
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: "Merchant not found" },
        { status: 404 }
      );
    }

    const tenantId = merchant.company.tenantId;
    const input = validation.data;

    const order = await cateringOrderService.createOrder(tenantId, merchantId, {
      customerFirstName: input.customerFirstName,
      customerLastName: input.customerLastName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      eventDate: input.eventDate,
      eventTime: input.eventTime,
      guestCount: input.guestCount,
      eventType: input.eventType,
      eventAddress: input.eventAddress,
      specialRequests: input.specialRequests,
      items: input.items as CateringOrderItem[],
      subtotal: input.subtotal,
      taxAmount: input.taxAmount,
      serviceCharge: input.serviceCharge,
      totalAmount: input.totalAmount,
      notes: input.notes,
      leadId: input.leadId,
    });

    return NextResponse.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    console.error("[Dashboard Catering Orders] Error creating order:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create catering order" },
      { status: 500 }
    );
  }
}
