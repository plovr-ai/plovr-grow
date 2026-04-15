import sharedMessages from "@/messages/shared/en.json";

const errorMessages: Record<string, string> = sharedMessages.errors;

/**
 * Extract a human-readable error message from an API error response.
 *
 * Handles both the legacy string format and the new `{ code }` object format
 * introduced by `withApiHandler`.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback?: string
): string {
  // Legacy: plain string error (non-empty)
  if (typeof error === "string" && error.length > 0) return error;

  // New format: { code: "ERROR_CODE", params?: {...} }
  if (
    error != null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    return errorMessages[code] ?? fallback ?? code;
  }

  // Fallback
  return fallback ?? errorMessages["INTERNAL_ERROR"] ?? "An unexpected error occurred";
}
