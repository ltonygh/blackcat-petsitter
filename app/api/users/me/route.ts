import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getUserProfile, updateUserProfile } from "@/db/queries/users";

/**
 * GET /api/users/me
 *
 * Returns the authenticated user's own profile, used by the frontend to
 * pre-fill the Profile Settings modal (e.g. phone number).
 *
 * Response: { user: { id, name, phone, email } }
 *
 * Tenant-scoped: fetched via withTenant under the caller's organization, and
 * `users` is RLS-protected, so a cross-tenant user is never returned.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, organizationId } = session.user;

  const profile = await getUserProfile(organizationId, userId);
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: profile.id,
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
    },
  });
}

/**
 * PATCH /api/users/me
 *
 * Update the authenticated user's own profile. Accepts { name?, phone? } and
 * returns the updated user. Tenant-scoped: the UPDATE runs via withTenant under
 * the caller's organization (and `users` is RLS-protected).
 *
 * Body (all optional, but at least one required):
 *   { "name": "Jane Doe", "phone": "+852 1234 5678" }
 *
 * Passing `null` clears a field.
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, organizationId } = session.user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, phone } = (body ?? {}) as {
    name?: unknown;
    phone?: unknown;
  };

  if (name === undefined && phone === undefined) {
    return NextResponse.json(
      { error: "No updatable fields provided (name, phone)" },
      { status: 400 },
    );
  }

  if (name !== undefined && name !== null && typeof name !== "string") {
    return NextResponse.json(
      { error: "name must be a string or null" },
      { status: 400 },
    );
  }
  if (phone !== undefined && phone !== null && typeof phone !== "string") {
    return NextResponse.json(
      { error: "phone must be a string or null" },
      { status: 400 },
    );
  }

  const updated = await updateUserProfile(organizationId, userId, {
    ...(name !== undefined ? { name: name as string | null } : {}),
    ...(phone !== undefined ? { phone: phone as string | null } : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: updated });
}
