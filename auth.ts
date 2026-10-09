import NextAuth from "next-auth";

import { authConfig } from "./auth.config";
import { findUserByEmail, upsertUserFromOAuth } from "./db/queries/users";

/**
 * Full NextAuth v5 (Auth.js) configuration.
 *
 * Extends the edge-safe `authConfig` (providers + route protection, used by
 * middleware) with the database-backed callbacks that run in the Node runtime:
 *
 *   - signIn : ensure the OAuth user exists in our DB (plain db client; this
 *              runs BEFORE any tenant context exists, so it must NOT use
 *              withTenant). Returns true to allow the sign-in.
 *   - jwt    : on the FIRST sign-in, load the user row by email and stash
 *              userId / organizationId / role onto the token. Subsequent
 *              invocations reuse the values already on the token.
 *   - session: copy userId / organizationId / role from the token onto
 *              session.user. This callback does NOT hit the database.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    // Preserve the edge-safe `authorized` callback used by middleware.
    ...authConfig.callbacks,

    async signIn({ user, account }) {
      // Persist the user on first sign-in. Uses the PLAIN db client because
      // no tenant context exists yet. Existing roles are never overwritten
      // (insert is ON CONFLICT DO NOTHING on email).
      if (user?.email) {
        await upsertUserFromOAuth({
          email: user.email,
          googleId: account?.providerAccountId ?? null,
          name: user.name ?? null,
        });
      }
      return true;
    },

    async jwt({ token, user }) {
      // `user` is only defined on the initial sign-in. On that pass, resolve
      // the DB row and attach the tenant context. On later passes the token
      // already carries these values, so we skip the query entirely.
      if (user?.email && !token.userId) {
        const row = await findUserByEmail(user.email);
        if (row) {
          token.userId = row.id;
          token.organizationId = row.organizationId;
          token.role = row.role;
        }
      }
      return token;
    },

    async session({ session, token }) {
      // No DB access here — read purely from the token (per constraints).
      if (session.user) {
        session.user.id = token.userId;
        session.user.organizationId = token.organizationId;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
