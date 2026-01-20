import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "loyalty-session-secret-key-change-in-production"
);
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Get the cookie name for a specific company
 * Uses companyId for tenant isolation
 */
function getCookieName(companyId: string): string {
  return `loyalty_session_${companyId}`;
}

export interface LoyaltySessionPayload {
  memberId: string;
  companyId: string;
  phone: string;
}

/**
 * Set loyalty session cookie after successful OTP verification
 */
export async function setLoyaltySession(
  companyId: string,
  memberId: string,
  phone: string
): Promise<void> {
  const token = await new SignJWT({ memberId, companyId, phone })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(getCookieName(companyId), token, {
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
  companyId: string
): Promise<LoyaltySessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName(companyId))?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);

    // Verify the companyId in the token matches the requested companyId
    if (payload.companyId !== companyId) {
      return null;
    }

    return {
      memberId: payload.memberId as string,
      companyId: payload.companyId as string,
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
export async function clearLoyaltySession(companyId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(getCookieName(companyId));
}
