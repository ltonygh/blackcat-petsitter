import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

/**
 * Proxy (formerly "middleware") — protects /dashboard, /owner and /staff.
 *
 * Next.js 16 renames the `middleware` file convention to `proxy`, and Proxy
 * now defaults to the Node.js runtime (no longer Edge). We build a
 * *proxy-only* NextAuth instance from the edge-safe `authConfig` (no database
 * imports) and export its handler as `proxy`, per the file-convention contract
 * ("must export a single function, either as a default export or named
 * `proxy`").
 *
 * Route protection lives in `authConfig.callbacks.authorized`: unauthenticated
 * requests to protected paths are redirected to the sign-in page (`/login`).
 *
 * NOTE: this only enforces AUTHENTICATION (logged-in or not). Role-based
 * authorisation (owner vs staff vs user) is enforced server-side in the
 * respective `app/{owner,staff}/layout.tsx` guards, because the role lives on
 * the session and is not available to the proxy without a DB/session decode.
 */
const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  matcher: ["/dashboard/:path*", "/owner/:path*", "/staff/:path*"],
};
