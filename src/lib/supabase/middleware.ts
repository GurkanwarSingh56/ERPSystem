import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAllowedRolesForPath, getRoleHomeDashboard } from "@/lib/auth/permissions";
import { UserRole } from "@/lib/auth/roles";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isLoginRoute = pathname === "/login";

  // For routes that do not require auth inspection or session state checks, return immediately
  if (!isDashboardRoute && !isLoginRoute) {
    return supabaseResponse;
  }

  // Securely refresh session token if expired
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) {
      user = data.user;
    }
  } catch (err) {
    console.warn("[proxy] supabase.auth.getUser error:", err instanceof Error ? err.message : err);
    // If Supabase is unreachable on dashboard routes, redirect to login with connection error
    if (isDashboardRoute) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "auth_service_unavailable");
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // 1. Unauthenticated route protection for /dashboard/*
  if (isDashboardRoute) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      // Safely preserve intended redirect path (preventing open redirects)
      if (pathname !== "/dashboard") {
        loginUrl.searchParams.set("redirectTo", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    // 2. Fetch authenticated profile role from public.profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (!profile || profile.status !== "active") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "account_inactive");
      return NextResponse.redirect(loginUrl);
    }

    const userRole = profile.role as UserRole;
    const allowedRoles = getAllowedRolesForPath(pathname);

    // If accessing root /dashboard, redirect to role home
    if (pathname === "/dashboard") {
      const home = getRoleHomeDashboard(userRole);
      return NextResponse.redirect(new URL(home, request.url));
    }

    // If route requires specific role membership, verify permission
    if (allowedRoles && !allowedRoles.includes(userRole)) {
      const home = getRoleHomeDashboard(userRole);
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  // 3. If authenticated user visits /login, redirect to their home dashboard
  if (pathname === "/login" && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (profile && profile.status === "active") {
      const redirectTo = request.nextUrl.searchParams.get("redirectTo");
      if (redirectTo && redirectTo.startsWith("/dashboard")) {
        return NextResponse.redirect(new URL(redirectTo, request.url));
      }
      const home = getRoleHomeDashboard(profile.role as UserRole);
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  return supabaseResponse;
}
