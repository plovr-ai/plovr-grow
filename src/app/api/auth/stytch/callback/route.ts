import { NextResponse } from "next/server";
import { getStytchServerClient } from "@/lib/stytch";
import { authService } from "@/services/auth";
import { AppError } from "@/lib/errors";
import { ErrorCodes } from "@/lib/errors/error-codes";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_token } = body;

    if (!session_token) {
      throw new AppError(ErrorCodes.AUTH_MISSING_SESSION_TOKEN, undefined, 400);
    }

    // Verify Stytch session
    const stytchClient = getStytchServerClient();
    let stytchResponse;
    try {
      stytchResponse = await stytchClient.sessions.authenticate({
        session_token,
      });
    } catch {
      throw new AppError(ErrorCodes.AUTH_INVALID_STYTCH_SESSION, undefined, 401);
    }

    const stytchUser = stytchResponse.user;
    const email = stytchUser.emails[0]?.email;

    if (!email) {
      throw new AppError(ErrorCodes.AUTH_MISSING_EMAIL, undefined, 400);
    }

    // Find or create user in our database
    const { user } = await authService.findOrCreateStytchUser(
      email,
      stytchUser.user_id
    );

    // Return user data for client-side NextAuth signIn
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        companyId: user.companyId,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: { code: error.code } },
        { status: error.statusCode }
      );
    }

    console.error("Stytch callback error:", error);
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.AUTH_STYTCH_CALLBACK_FAILED } },
      { status: 500 }
    );
  }
}
