import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api";
import { invoiceService } from "@/services/invoice";
import { merchantService } from "@/services/merchant";

const sendInvoiceSchema = z.object({
  dueDate: z.string().transform((str) => new Date(str)),
});

// POST: Create invoice and send to customer
export const POST = withApiHandler(async (request: NextRequest, context) => {
  const { merchantId, orderId } = await context.params;
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

  const tenantId = merchant.tenant.tenantId;

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
});
