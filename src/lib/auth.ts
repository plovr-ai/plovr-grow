import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { loginSchema } from "@/lib/validations/auth";
import { mockUserStore } from "@/services/auth/mock-store";
import { initTestData } from "@/services/auth/init-test-data";

// Initialize test data on first load
initTestData().catch(console.error);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate input
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Find user by email (using mock store)
        const user = mockUserStore.findByEmail(email);

        if (!user || user.status !== "active") return null;

        // Verify password
        const isValid = await compare(password, user.passwordHash);
        if (!isValid) return null;

        // Update last login
        mockUserStore.updateLastLogin(user.id);

        // Return user data for JWT
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          companyId: user.companyId,
        };
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
