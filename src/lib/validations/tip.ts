import { z } from "zod";

const TIP_MODES = ["fixed", "percentage"] as const;

export const tipConfigSchema = z
  .object({
    mode: z.enum(TIP_MODES),
    tiers: z
      .array(z.number().nonnegative())
      .min(1, "At least 1 tip tier is required")
      .max(3, "Maximum 3 tip tiers allowed"),
    allowCustom: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.mode === "percentage") {
        return data.tiers.every((t) => t >= 0 && t <= 1);
      }
      return true;
    },
    {
      message: "Percentages must be between 0 and 1 (e.g., 0.15 for 15%)",
      path: ["tiers"],
    }
  );
