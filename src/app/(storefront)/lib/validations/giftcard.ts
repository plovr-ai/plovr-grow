import { z } from "zod";

const giftcardFormSchema = z.object({
  amount: z.number().positive("Amount is required"),
  recipientName: z.string().optional(),
  recipientEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  buyerFirstName: z.string().min(1, "First name is required").trim(),
  buyerLastName: z.string().min(1, "Last name is required").trim(),
  buyerPhone: z.string().regex(
    /^\(\d{3}\) \d{3}-\d{4}$/,
    "Phone must be in format (xxx) xxx-xxxx"
  ),
  buyerEmail: z.string().email("Invalid email"),
  message: z.string().max(200, "Message too long (max 200 characters)").optional(),
});

// Extended schema for API validation (includes payment intent)
export const giftcardApiSchema = giftcardFormSchema.extend({
  stripePaymentIntentId: z.string().optional(),
});

export type GiftcardApiData = z.infer<typeof giftcardApiSchema>;
