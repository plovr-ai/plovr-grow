import { z } from "zod";

// Order modes
export const ORDER_MODES = ["pickup", "delivery", "dine_in"] as const;
export type OrderMode = (typeof ORDER_MODES)[number];

// US phone regex (flexible format)
const phoneRegex = /^\+?1?\s*\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;

// US state codes
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
] as const;

// Contact information schema (used inline by checkoutFormSchema)
const contactInfoSchema = z.object({
  customerFirstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name must be less than 50 characters")
    .trim(),
  customerLastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name must be less than 50 characters")
    .trim(),
  customerPhone: z
    .string()
    .regex(phoneRegex, "Please enter a valid phone number"),
  customerEmail: z
    .string()
    .email("Please enter a valid email")
    .optional()
    .or(z.literal("")),
});

// Delivery address schema
export const deliveryAddressSchema = z.object({
  street: z
    .string()
    .min(5, "Street address is required")
    .max(200, "Address too long"),
  apt: z
    .string()
    .max(20, "Apt/Suite too long")
    .optional()
    .or(z.literal("")),
  city: z
    .string()
    .min(2, "City is required")
    .max(100, "City name too long"),
  state: z.enum(US_STATES, { message: "Please select a state" }),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Please enter a valid ZIP code"),
  instructions: z
    .string()
    .max(500, "Instructions too long")
    .optional()
    .or(z.literal("")),
});

// Checkout form schema
export const checkoutFormSchema = z
  .object({
    orderMode: z.enum(ORDER_MODES),
    customerFirstName: contactInfoSchema.shape.customerFirstName,
    customerLastName: contactInfoSchema.shape.customerLastName,
    customerPhone: contactInfoSchema.shape.customerPhone,
    customerEmail: contactInfoSchema.shape.customerEmail,
    deliveryAddress: deliveryAddressSchema.optional(),
    tipAmount: z.number().min(0, "Tip cannot be negative").optional(),
    notes: z.string().max(500, "Notes too long").optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.orderMode === "delivery") {
        return data.deliveryAddress !== undefined;
      }
      return true;
    },
    {
      message: "Delivery address is required for delivery orders",
      path: ["deliveryAddress"],
    }
  );

// Type exports
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;
