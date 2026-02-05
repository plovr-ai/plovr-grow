import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cateringOrderService } from "@/services/catering";
import { merchantService } from "@/services/merchant";
import type { CateringOrderItem } from "@/services/catering/catering-order.types";

interface RouteParams {
  params: Promise<{ merchantId: string; orderId: string }>;
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

const updateCateringOrderSchema = z.object({
  customerFirstName: z.string().min(1).optional(),
  customerLastName: z.string().min(1).optional(),
  customerPhone: z.string().min(1).optional(),
  customerEmail: z.string().email().optional(),
  eventDate: z.string().transform((str) => new Date(str)).optional(),
  eventTime: z.string().min(1).optional(),
  guestCount: z.number().int().positive().optional(),
  eventType: z.string().nullable().optional(),
  eventAddress: z.string().nullable().optional(),
  specialRequests: z.string().nullable().optional(),
  items: z.array(cateringOrderItemSchema).min(1).optional(),
  subtotal: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  serviceCharge: z.number().nonnegative().optional(),
  totalAmount: z.number().nonnegative().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["draft", "sent", "paid", "completed", "cancelled"]).optional(),
});

// GET: Get catering order details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { merchantId, orderId } = await params;

    // Get merchant to find tenant
    const merchant = await merchantService.getMerchantById(merchantId);
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: "Merchant not found" },
        { status: 404 }
      );
    }

    const tenantId = merchant.company.tenantId;

    const order = await cateringOrderService.getOrder(tenantId, orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Catering order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    console.error("[Dashboard Catering Order] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get catering order" },
      { status: 500 }
    );
  }
}

// PATCH: Update catering order
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { merchantId, orderId } = await params;
    const body = await request.json();

    // Validate input
    const validation = updateCateringOrderSchema.safeParse(body);
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

    // If only status is being updated, use updateOrderStatus
    if (input.status && Object.keys(input).length === 1) {
      await cateringOrderService.updateOrderStatus(tenantId, orderId, input.status);
      const order = await cateringOrderService.getOrder(tenantId, orderId);
      return NextResponse.json({
        success: true,
        data: { order },
      });
    }

    // Otherwise, update the order
    const order = await cateringOrderService.updateOrder(tenantId, orderId, {
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
      items: input.items as CateringOrderItem[] | undefined,
      subtotal: input.subtotal,
      taxAmount: input.taxAmount,
      serviceCharge: input.serviceCharge,
      totalAmount: input.totalAmount,
      notes: input.notes,
    });

    return NextResponse.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    console.error("[Dashboard Catering Order] Error updating order:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update catering order" },
      { status: 500 }
    );
  }
}

// DELETE: Delete catering order (only if draft)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { merchantId, orderId } = await params;

    // Get merchant to find tenant
    const merchant = await merchantService.getMerchantById(merchantId);
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: "Merchant not found" },
        { status: 404 }
      );
    }

    const tenantId = merchant.company.tenantId;

    await cateringOrderService.deleteOrder(tenantId, orderId);

    return NextResponse.json({
      success: true,
      message: "Catering order deleted",
    });
  } catch (error) {
    console.error("[Dashboard Catering Order] Error deleting order:", error);
    const message = error instanceof Error ? error.message : "Failed to delete catering order";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
