import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

/**
 * Middleware — protects /dashboard, /owner and /staff.
 *
 * We build a *middleware-only* NextAuth instance from the edge-safe
 * `authConfig` (no database imports), because middleware runs on the Edge
 * runtime. Route protection lives in `authConfig.callbacks.authorized`:
 * unauthenticated requests to protected paths are redirected to the sign-in
 * page (configured as `/login`).
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/dashboard/:path*", "/owner/:path*", "/staff/:path*"],
};
