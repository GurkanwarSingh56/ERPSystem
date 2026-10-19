import { createClient } from "@/lib/supabase/server";
import { AuthContextUser, UserProfile, UserRole } from "./roles";

export class AuthorizationError extends Error {
  constructor(message: string, public code: "UNAUTHENTICATED" | "FORBIDDEN" | "INACTIVE_ACCOUNT" | "TENANT_MISMATCH" = "FORBIDDEN") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Server-side identity resolver.
 * Fetches the verified authenticated user and resolves their public profile from PostgreSQL.
 * NEVER trusts client-supplied headers, metadata cookies, or query parameters.
 */
export async function getAuthenticatedProfile(): Promise<AuthContextUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Fetch verified profile from PostgreSQL public.profiles
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, institution_id, role, status, email, full_name, login_id, must_change_password, can_access_accounts")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return {
    userId: profile.id,
    institutionId: profile.institution_id,
    role: profile.role as UserRole,
    email: profile.email,
    fullName: profile.full_name,
    isActive: profile.status === "active",
    loginId: profile.login_id,
    mustChangePassword: Boolean(profile.must_change_password),
    canAccessAccounts: Boolean(profile.can_access_accounts),
  };
}

/**
 * Enforces authentication and active account status on the server.
 * Throws typed AuthorizationError if unauthenticated or inactive.
 */
export async function requireAuth(): Promise<AuthContextUser> {
  const user = await getAuthenticatedProfile();
  if (!user) {
    throw new AuthorizationError("Authentication required.", "UNAUTHENTICATED");
  }
  if (!user.isActive) {
    throw new AuthorizationError("Account is suspended or inactive.", "INACTIVE_ACCOUNT");
  }
  return user;
}

/**
 * Enforces role membership on the server.
 * Independent of proxy/middleware checks and RLS checks.
 */
export async function requireRole(allowedRoles: readonly UserRole[]): Promise<AuthContextUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError(
      `Access denied: Required role (${allowedRoles.join(", ")}) not satisfied by user role (${user.role}).`,
      "FORBIDDEN"
    );
  }
  return user;
}

/**
 * Enforces Accounts / Cashier portal access.
 * Permitted for administrators, cashiers, and any faculty/staff explicitly granted accounts access.
 */
export async function requireAccountsAccess(): Promise<AuthContextUser> {
  const user = await requireAuth();
  if (user.role === "admin" || user.role === "cashier" || user.canAccessAccounts) {
    return user;
  }
  throw new AuthorizationError(
    "Access denied: Cashier or Accounts authorization required.",
    "FORBIDDEN"
  );
}

/**
 * Enforces tenant boundary for any target entity.
 */
export async function requireTenantMatch(targetInstitutionId: string): Promise<AuthContextUser> {
  const user = await requireAuth();
  if (user.institutionId !== targetInstitutionId) {
    throw new AuthorizationError(
      "Cross-institution access violation: Action rejected.",
      "TENANT_MISMATCH"
    );
  }
  return user;
}
