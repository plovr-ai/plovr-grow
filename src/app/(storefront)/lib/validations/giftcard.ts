import { z } from "zod";

export const giftcardFormSchema = z.object({
  amount: z.number().positive("Amount is required"),
  recipientName: z.string().optional(),
  recipientEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  buyerName: z.string().min(1, "Name is required"),
  buyerPhone: z.string().regex(
    /^\(\d{3}\) \d{3}-\d{4}$/,
    "Phone must be in format (xxx) xxx-xxxx"
  ),
  buyerEmail: z.string().email("Invalid email"),
  message: z.string().max(200, "Message too long (max 200 characters)").optional(),
});

export type GiftcardFormData = z.infer<typeof giftcardFormSchema>;
