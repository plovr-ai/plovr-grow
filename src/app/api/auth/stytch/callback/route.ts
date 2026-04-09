import { NextResponse } from "next/server";
import { getStytchServerClient } from "@/lib/stytch";
import { authService } from "@/services/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_token } = body;

    if (!session_token) {
      return NextResponse.json(
        { error: "Missing session_token" },
        { status: 400 }
      );
    }

    // Verify Stytch session
    const stytchClient = getStytchServerClient();
    let stytchResponse;
    try {
      stytchResponse = await stytchClient.sessions.authenticate({
        session_token,
      });
    } catch {
      return NextResponse.json(
        { error: "Invalid Stytch session" },
        { status: 401 }
      );
    }

    const stytchUser = stytchResponse.user;
    const email = stytchUser.emails[0]?.email;

    if (!email) {
      return NextResponse.json(
        { error: "No email found in Stytch user" },
        { status: 400 }
      );
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
    console.error("Stytch callback error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
