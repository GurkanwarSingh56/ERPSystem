export type UserRole = "admin" | "principal" | "hod" | "teacher" | "student" | "cashier";

export type UserStatus = "active" | "inactive" | "suspended";

export interface UserProfile {
  id: string;
  institution_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  status: UserStatus;
  avatar_url: string | null;
  login_id?: string | null;
  must_change_password?: boolean;
  can_access_accounts?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthContextUser {
  userId: string;
  institutionId: string;
  role: UserRole;
  email: string;
  fullName: string;
  isActive: boolean;
  loginId?: string | null;
  mustChangePassword?: boolean;
  canAccessAccounts?: boolean;
}

export const ALL_ROLES: readonly UserRole[] = [
  "admin",
  "principal",
  "hod",
  "teacher",
  "student",
  "cashier",
] as const;

export function isValidRole(role: unknown): role is UserRole {
  return typeof role === "string" && ALL_ROLES.includes(role as UserRole);
}
