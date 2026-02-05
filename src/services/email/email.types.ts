export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export interface SendInvoiceEmailInput {
  to: string;
  customerName: string;
  invoiceNumber: string;
  orderNumber: string;
  eventDate: Date;
  eventTime: string;
  totalAmount: number;
  dueDate: Date;
  paymentLink: string;
  merchantName: string;
  currency: string;
  locale: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
