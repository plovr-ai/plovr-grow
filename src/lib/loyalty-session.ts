import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "loyalty-session-secret-key-change-in-production"
);
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Get the cookie name for a specific tenant.
 * NOTE: cookie name changed from `loyalty_session_<companyId>` to
 * `loyalty_session_<tenantId>` as part of the Company → Tenant merge cleanup.
 * Existing sessions from before this change will be invalidated and affected
 * loyalty members will need to re-login once (acceptable for this refactor).
 */
function getCookieName(tenantId: string): string {
  return `loyalty_session_${tenantId}`;
}

export interface LoyaltySessionPayload {
  memberId: string;
  tenantId: string;
  phone: string;
}

/**
 * Set loyalty session cookie after successful OTP verification
 */
export async function setLoyaltySession(
  tenantId: string,
  memberId: string,
  phone: string
): Promise<void> {
  const token = await new SignJWT({ memberId, tenantId, phone })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(getCookieName(tenantId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Get loyalty session from cookie
 * Returns null if no valid session exists
 */
export async function getLoyaltySession(
  tenantId: string
): Promise<LoyaltySessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName(tenantId))?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);

    // Verify the tenantId in the token matches the requested tenantId
    if (payload.tenantId !== tenantId) {
      return null;
    }

    return {
      memberId: payload.memberId as string,
      tenantId: payload.tenantId as string,
      phone: payload.phone as string,
    };
  } catch {
    // Token is invalid or expired
    return null;
  }
}

/**
 * Clear loyalty session cookie (logout)
 */
export async function clearLoyaltySession(tenantId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(getCookieName(tenantId));
}
