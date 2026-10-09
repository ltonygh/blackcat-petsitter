import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe portion of the NextAuth configuration.
 *
 * This file must NOT import anything that touches the database (postgres,
 * node:crypto, etc.), because it is consumed by `middleware.ts`, which runs on
 * the Edge runtime. It holds only the provider list and the route-protection
 * logic (`authorized`).
 *
 * The full configuration in `auth.ts` spreads this object and adds the
 * database-backed `signIn` / `jwt` / `session` callbacks.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    /**
     * Route protection used by the middleware. Returning false redirects the
     * request to the sign-in page. Unauthenticated users may only reach
     * non-protected routes (and the /login page itself).
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = nextUrl;

      const isProtected =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/owner") ||
        pathname.startsWith("/staff");

      if (isProtected) {
        return isLoggedIn;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
