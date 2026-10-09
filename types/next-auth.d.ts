import type { DefaultSession } from "next-auth";

/**
 * NextAuth v5 type augmentation.
 *
 * Extends the Session and JWT shapes so the tenant context (userId,
 * organizationId, role) is available end-to-end:
 *   - `token` (JWT) carries the values persisted at sign-in time.
 *   - `session.user` is populated from the token in the session callback.
 *
 * NOTE: in NextAuth v5 the JWT interface is declared in `@auth/core/jwt`
 * (re-exported by `next-auth/jwt`). We augment the declaring module so the
 * `token` parameter of the `jwt` callback is typed correctly.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "owner" | "staff";
      organizationId: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    organizationId: string;
    role: "user" | "owner" | "staff";
  }
}
