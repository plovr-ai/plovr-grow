import { z } from "zod";

// Claim schema (for claiming trial websites)
export const claimSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  email: z.string().email("Please enter a valid email"),
});

// Type exports
export type ClaimInput = z.infer<typeof claimSchema>;
