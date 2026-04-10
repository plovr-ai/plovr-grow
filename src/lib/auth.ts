import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getStytchServerClient } from "@/lib/stytch";
import { authService } from "@/services/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    // Stytch login provider — verifies session_token server-side
    Credentials({
      id: "stytch",
      name: "stytch",
      credentials: {
        session_token: { type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.session_token) return null;

        try {
          const stytchClient = getStytchServerClient();
          const stytchResponse = await stytchClient.sessions.authenticate({
            session_token: credentials.session_token as string,
          });

          const email = stytchResponse.user.emails[0]?.email;
          if (!email) return null;

          const { user } = await authService.findOrCreateStytchUser(
            email,
            stytchResponse.user.user_id
          );

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            companyId: user.companyId,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.companyId = user.companyId;
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.tenantId = token.tenantId as string;
        session.user.companyId = token.companyId as string | null;
      }
      return session;
    },
  },

  pages: {
    signIn: "/dashboard/login",
    error: "/dashboard/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
});
