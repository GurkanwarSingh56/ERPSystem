import { UserRole } from "./roles";

export interface RouteRule {
  prefix: string;
  allowedRoles: readonly UserRole[];
}

export const ROUTE_PERMISSIONS: readonly RouteRule[] = [
  {
    prefix: "/dashboard/admin",
    allowedRoles: ["admin"],
  },
  {
    prefix: "/dashboard/principal",
    allowedRoles: ["principal", "admin"],
  },
  {
    prefix: "/dashboard/hod",
    allowedRoles: ["hod", "principal", "admin"],
  },
  {
    prefix: "/dashboard/teacher",
    allowedRoles: ["teacher", "admin"],
  },
  {
    prefix: "/dashboard/student",
    allowedRoles: ["student"],
  },
] as const;

export function getAllowedRolesForPath(pathname: string): readonly UserRole[] | null {
  for (const rule of ROUTE_PERMISSIONS) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.allowedRoles;
    }
  }
  return null;
}

export function isPathAuthorizedForRole(pathname: string, role: UserRole): boolean {
  const allowed = getAllowedRolesForPath(pathname);
  if (!allowed) {
    // If not a role-specific dashboard path, allow access to common dashboard pages
    return true;
  }
  return allowed.includes(role);
}

export function getRoleHomeDashboard(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "principal":
      return "/dashboard/principal";
    case "hod":
      return "/dashboard/hod";
    case "teacher":
      return "/dashboard/teacher";
    case "student":
      return "/dashboard/student";
    default:
      return "/login";
  }
}
