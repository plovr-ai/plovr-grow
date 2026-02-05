import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { invoiceService } from "@/services/invoice";
import { merchantService } from "@/services/merchant";

interface RouteParams {
  params: Promise<{ merchantId: string; orderId: string }>;
}

const sendInvoiceSchema = z.object({
  dueDate: z.string().transform((str) => new Date(str)),
});

// POST: Create invoice and send to customer
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { merchantId, orderId } = await params;
    const body = await request.json();

    // Validate input
    const validation = sendInvoiceSchema.safeParse(body);
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

    // Check if invoice already exists
    const existingInvoice = await invoiceService.getInvoiceByCateringOrderId(
      tenantId,
      orderId
    );

    let invoice;
    if (existingInvoice) {
      // If invoice exists, just send it again
      invoice = existingInvoice;
    } else {
      // Create new invoice with Stripe payment link
      invoice = await invoiceService.createInvoice(tenantId, orderId, {
        dueDate: validation.data.dueDate,
      });
    }

    // Send invoice email
    await invoiceService.sendInvoice(tenantId, invoice.id);

    return NextResponse.json({
      success: true,
      data: { invoice },
      message: "Invoice sent successfully",
    });
  } catch (error) {
    console.error("[Dashboard Send Invoice] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to send invoice";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
