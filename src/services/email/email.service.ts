import { formatPrice } from "@/lib/utils";
import type {
  SendEmailInput,
  SendInvoiceEmailInput,
  EmailResult,
} from "./email.types";

/**
 * Email Service (Mock Mode)
 *
 * This is a mock implementation that logs emails to console.
 * To enable real email sending, replace with a provider like Resend or SendGrid.
 */
export class EmailService {
  /**
   * Send a generic email
   */
  async sendEmail(input: SendEmailInput): Promise<EmailResult> {
    console.log("\n========== [Email Service - Mock Mode] ==========");
    console.log("To:", input.to);
    console.log("Subject:", input.subject);
    console.log("HTML Body:", input.html);
    console.log("=================================================\n");

    return {
      success: true,
      messageId: `mock_${crypto.randomUUID()}`,
    };
  }

  /**
   * Send an invoice email to customer
   */
  async sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<EmailResult> {
    const formattedAmount = formatPrice(input.totalAmount, input.currency, input.locale);
    const formattedEventDate = new Date(input.eventDate).toLocaleDateString(input.locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formattedDueDate = new Date(input.dueDate).toLocaleDateString(input.locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = this.generateInvoiceEmailHtml({
      ...input,
      formattedAmount,
      formattedEventDate,
      formattedDueDate,
    });

    return this.sendEmail({
      to: input.to,
      subject: `Invoice ${input.invoiceNumber} from ${input.merchantName}`,
      html,
    });
  }

  /**
   * Generate HTML for invoice email
   */
  private generateInvoiceEmailHtml(input: {
    customerName: string;
    invoiceNumber: string;
    orderNumber: string;
    formattedEventDate: string;
    eventTime: string;
    formattedAmount: string;
    formattedDueDate: string;
    paymentLink: string;
    merchantName: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${input.invoiceNumber}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="margin: 0; color: #111;">Invoice from ${input.merchantName}</h1>
  </div>

  <p>Hi ${input.customerName},</p>

  <p>Thank you for choosing ${input.merchantName} for your catering needs. Please find your invoice details below:</p>

  <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #666;">Invoice Number:</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${input.invoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Order Number:</td>
        <td style="padding: 8px 0; text-align: right;">${input.orderNumber}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Event Date:</td>
        <td style="padding: 8px 0; text-align: right;">${input.formattedEventDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Event Time:</td>
        <td style="padding: 8px 0; text-align: right;">${input.eventTime}</td>
      </tr>
      <tr style="border-top: 2px solid #e5e7eb;">
        <td style="padding: 16px 0 8px; font-weight: 600; font-size: 18px;">Total Amount:</td>
        <td style="padding: 16px 0 8px; text-align: right; font-weight: 600; font-size: 18px; color: #111;">${input.formattedAmount}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Due Date:</td>
        <td style="padding: 8px 0; text-align: right; color: #dc2626; font-weight: 500;">${input.formattedDueDate}</td>
      </tr>
    </table>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${input.paymentLink}" style="display: inline-block; background: #111; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
      Pay Now
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    If you have any questions about this invoice, please contact us at ${input.merchantName}.
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    This invoice was sent by ${input.merchantName}.
  </p>
</body>
</html>
    `.trim();
  }
}

export const emailService = new EmailService();
