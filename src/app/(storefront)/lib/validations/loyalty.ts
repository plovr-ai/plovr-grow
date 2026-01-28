import { z } from "zod";

// Loyalty registration form validation schema
export const loyaltyRegistrationSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name must be less than 50 characters")
    .trim(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name must be less than 50 characters")
    .trim(),
  email: z.string().email("Please enter a valid email"),
});

export type LoyaltyRegistrationData = z.infer<typeof loyaltyRegistrationSchema>;
