"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleHomeDashboard } from "@/lib/auth/permissions";
import { UserRole } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const signInSchema = z.object({
  identifier: z.string().min(1, "Please enter your Login ID or Email address"),
  password: z.string().min(1, "Please enter your password"),
  redirectTo: z.string().optional(),
});

export type ActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function signInAction(prevState: unknown, formData: FormData): Promise<ActionResponse> {
  const rawIdentifier = (formData.get("identifier") || formData.get("email") || "").toString().trim();
  const rawPassword = (formData.get("password") || "").toString();
  const rawRedirectTo = (formData.get("redirectTo") || "").toString().trim() || undefined;

  const rawData = {
    identifier: rawIdentifier,
    password: rawPassword,
    redirectTo: rawRedirectTo,
  };

  const parseResult = signInSchema.safeParse(rawData);
  if (!parseResult.success) {
    const fieldErrors: Record<string, string> = {};
    parseResult.error.issues.forEach((issue) => {
      if (issue.path[0]) {
        fieldErrors[issue.path[0].toString()] = issue.message;
      }
    });
    return { success: false, fieldErrors, error: "Validation failed." };
  }

  const { identifier, password, redirectTo } = parseResult.data;
  const supabase = await createClient();

  // Resolve Login ID to Auth email address securely on the server
  let resolvedEmail = identifier;
  if (!identifier.includes("@")) {
    const adminClient = createAdminClient();
    const { data: matchedProfile, error: profileLookupError } = await adminClient
      .from("profiles")
      .select("email, status")
      .ilike("login_id", identifier)
      .maybeSingle();

    if (profileLookupError || !matchedProfile) {
      // Open enumerability defense: return uniform invalid credentials error
      return {
        success: false,
        error: "Invalid login ID or password. Please check your credentials.",
      };
    }

    resolvedEmail = matchedProfile.email;
  }

  let authData: any = null;
  let authError: any = null;

  try {
    const res = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });
    authData = res.data;
    authError = res.error;
  } catch (err: any) {
    console.error("[signInAction] Connection/Network failure during signInWithPassword:", {
      message: err?.message,
      name: err?.name,
      status: err?.status,
    });
    return {
      success: false,
      error: "Authentication service is currently unreachable. Please check your local connection or try again shortly.",
    };
  }

  if (authError || !authData?.user) {
    // Check if error is network / retryable fetch error
    if (
      authError?.name === "AuthRetryableFetchError" ||
      authError?.status === 0 ||
      authError?.message?.includes("fetch failed")
    ) {
      console.error("[signInAction] Supabase Auth connection failed:", {
        message: authError.message,
        name: authError.name,
        status: authError.status,
      });
      return {
        success: false,
        error: "Cannot connect to authentication service. Please ensure the local database is running.",
      };
    }

    return {
      success: false,
      error: "Invalid login ID or password. Please check your credentials.",
    };
  }

  // Fetch verified profile status and flags
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, status, must_change_password")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: "User profile record not found. Please contact administration.",
    };
  }

  if (profile.status !== "active") {
    await supabase.auth.signOut();
    return {
      success: false,
      error: "Your account is inactive or suspended. Contact administration.",
    };
  }

  // Enforce first-login password change
  if (profile.must_change_password) {
    redirect("/reset-password?required=true");
  }

  // Open redirect defense: only allow relative dashboard routes
  let targetUrl = getRoleHomeDashboard(profile.role as UserRole);
  if (redirectTo && redirectTo.startsWith("/dashboard") && !redirectTo.startsWith("//")) {
    targetUrl = redirectTo;
  }

  redirect(targetUrl);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const resetRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function resetPasswordRequestAction(prevState: unknown, formData: FormData): Promise<ActionResponse> {
  const rawEmail = formData.get("email");
  const parseResult = resetRequestSchema.safeParse({ email: rawEmail });

  if (!parseResult.success) {
    return {
      success: false,
      error: "Please enter a valid email address.",
    };
  }

  const { email } = parseResult.data;
  const supabase = await createClient();

  // Call Supabase Auth password recovery
  // Security rule: Never reveal whether an email address exists in the system
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password`,
  });

  return {
    success: true,
  };
}

const updatePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export async function updatePasswordAction(prevState: unknown, formData: FormData): Promise<ActionResponse> {
  const rawData = {
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parseResult = updatePasswordSchema.safeParse(rawData);
  if (!parseResult.success) {
    const fieldErrors: Record<string, string> = {};
    parseResult.error.issues.forEach((issue) => {
      if (issue.path[0]) {
        fieldErrors[issue.path[0].toString()] = issue.message;
      }
    });
    return { success: false, fieldErrors, error: "Validation failed." };
  }

  const { password } = parseResult.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      success: false,
      error: error.message || "Failed to update password. Recovery link may have expired.",
    };
  }

  // Clear must_change_password flag on the verified profile
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const adminClient = createAdminClient();
    await adminClient
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role) {
      redirect(getRoleHomeDashboard(profile.role as UserRole));
    }
  }

  redirect("/login?message=password_updated");
}

// ============================================================================
// ADMIN ACCOUNT PROVISIONING & CREDENTIAL GOVERNANCE
// ============================================================================

export type ProvisionRecordResult = {
  id: string;
  name: string;
  role: string;
  loginId: string;
  status: "provisioned" | "skipped" | "failed";
  reason?: string;
};

export type ProvisionAccountsResponse = {
  success: boolean;
  error?: string;
  summary?: {
    totalScanned: number;
    provisionedCount: number;
    skippedCount: number;
    failedCount: number;
  };
  details?: ProvisionRecordResult[];
};

/**
 * Server Action: Provision user accounts and assign Login IDs for teachers and students.
 * Strictly restricted to administrators.
 * Idempotent: Skips accounts that are already provisioned with Login IDs.
 */
export async function provisionAccountsAction(): Promise<ProvisionAccountsResponse> {
  try {
    const caller = await requireRole(["admin"]);
    const adminClient = createAdminClient();
    const institutionId = caller.institutionId;

    // 1. Fetch profiles in institution
    const { data: profiles, error: pErr } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role, login_id, status")
      .eq("institution_id", institutionId);

    if (pErr || !profiles) {
      return { success: false, error: pErr?.message || "Failed to query profiles." };
    }

    // 2. Fetch existing teachers with employee_id
    const { data: teachers, error: tErr } = await adminClient
      .from("teachers")
      .select("id, employee_id")
      .eq("institution_id", institutionId);

    if (tErr) {
      return { success: false, error: tErr.message };
    }
    const teacherMap = new Map((teachers || []).map((t) => [t.id, t.employee_id]));

    // 3. Fetch existing students with roll_number and admission_number
    const { data: students, error: sErr } = await adminClient
      .from("students")
      .select("id, roll_number, admission_number")
      .eq("institution_id", institutionId);

    if (sErr) {
      return { success: false, error: sErr.message };
    }
    const studentMap = new Map((students || []).map((s) => [s.id, { roll: s.roll_number, adm: s.admission_number }]));

    // 4. Fetch auth users list
    const { data: authUsersResult } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const authUserSet = new Set((authUsersResult?.users || []).map((u) => u.id));

    // 5. Build set of assigned login IDs (lowercase)
    const assignedLoginIds = new Set<string>();
    for (const p of profiles) {
      if (p.login_id) {
        assignedLoginIds.add(p.login_id.toLowerCase().trim());
      }
    }

    const defaultTempPassword = process.env.INITIAL_DEFAULT_PASSWORD || "CollegeERP@2026";
    let provisionedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const details: ProvisionRecordResult[] = [];

    for (const p of profiles) {
      const isAuthLinked = authUserSet.has(p.id);

      // If already linked to Auth and already has Login ID, skip idempotently
      if (isAuthLinked && p.login_id && p.login_id.trim().length > 0) {
        skippedCount++;
        details.push({
          id: p.id,
          name: p.full_name,
          role: p.role,
          loginId: p.login_id,
          status: "skipped",
          reason: "Already linked to Auth and provisioned with Login ID",
        });
        continue;
      }

      // Determine candidate Login ID based on institutional priority rules
      let candidateId: string | null = null;
      if (p.role === "principal") {
        candidateId = p.login_id?.trim() || "PRINCIPAL";
      } else if (p.role === "hod") {
        candidateId = teacherMap.get(p.id)?.trim() || p.login_id?.trim() || "HOD";
      } else if (p.role === "teacher") {
        candidateId = teacherMap.get(p.id)?.trim() || p.login_id?.trim() || null;
      } else if (p.role === "student") {
        // Priority rule for students: 1. roll_number -> 2. admission_number
        const sInfo = studentMap.get(p.id);
        candidateId = sInfo?.roll?.trim() || sInfo?.adm?.trim() || null;
      } else if (p.role === "admin") {
        candidateId = p.login_id?.trim() || "ADMIN";
      } else if (p.role === "cashier") {
        candidateId = p.login_id?.trim() || "CASHIER";
      } else {
        candidateId = p.login_id?.trim() || p.email.split("@")[0].toUpperCase();
      }

      if (!candidateId) {
        failedCount++;
        details.push({
          id: p.id,
          name: p.full_name,
          role: p.role,
          loginId: "",
          status: "failed",
          reason: "Missing institutional identifier (employee ID or roll number)",
        });
        continue;
      }

      // Check for collision with an already assigned ID on another profile
      const lowerCandidate = candidateId.toLowerCase();
      if (assignedLoginIds.has(lowerCandidate) && p.login_id?.toLowerCase() !== lowerCandidate) {
        failedCount++;
        details.push({
          id: p.id,
          name: p.full_name,
          role: p.role,
          loginId: candidateId,
          status: "failed",
          reason: `Duplicate Login ID collision: "${candidateId}" is already assigned to another user`,
        });
        continue;
      }

      // If Auth user does NOT exist, create missing Auth account with initial temporary password
      if (!isAuthLinked) {
        const { error: createAuthErr } = await adminClient.auth.admin.createUser({
          id: p.id,
          email: p.email,
          password: defaultTempPassword,
          email_confirm: true,
          user_metadata: { full_name: p.full_name, role: p.role },
        });

        if (createAuthErr) {
          failedCount++;
          details.push({
            id: p.id,
            name: p.full_name,
            role: p.role,
            loginId: candidateId,
            status: "failed",
            reason: `Auth creation error: ${createAuthErr.message}`,
          });
          continue;
        }

        // Set login_id and enforce mandatory first-login password change
        const { error: updErr } = await adminClient
          .from("profiles")
          .update({ login_id: candidateId, must_change_password: true })
          .eq("id", p.id);

        if (updErr) {
          failedCount++;
          details.push({
            id: p.id,
            name: p.full_name,
            role: p.role,
            loginId: candidateId,
            status: "failed",
            reason: updErr.message,
          });
          continue;
        }

        assignedLoginIds.add(lowerCandidate);
        authUserSet.add(p.id);
        provisionedCount++;
        details.push({
          id: p.id,
          name: p.full_name,
          role: p.role,
          loginId: candidateId,
          status: "provisioned",
          reason: "Auth account created and linked with first-login password change",
        });
      } else {
        // Auth user already exists: assign login ID without overwriting their existing password
        const { error: updErr } = await adminClient
          .from("profiles")
          .update({ login_id: candidateId })
          .eq("id", p.id);

        if (updErr) {
          failedCount++;
          details.push({
            id: p.id,
            name: p.full_name,
            role: p.role,
            loginId: candidateId,
            status: "failed",
            reason: updErr.message,
          });
          continue;
        }

        assignedLoginIds.add(lowerCandidate);
        provisionedCount++;
        details.push({
          id: p.id,
          name: p.full_name,
          role: p.role,
          loginId: candidateId,
          status: "provisioned",
          reason: "Login ID assigned to existing Auth account",
        });
      }
    }

    return {
      success: true,
      summary: {
        totalScanned: profiles.length,
        provisionedCount,
        skippedCount,
        failedCount,
      },
      details,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to provision accounts." };
  }
}

/**
 * Server Action: Reset a specific user's credentials to the temporary password.
 * Sets must_change_password = true so the user is forced to change it upon next login.
 */
export async function adminResetUserPasswordAction({
  userId,
}: {
  userId: string;
}): Promise<ActionResponse> {
  try {
    const caller = await requireRole(["admin"]);
    const adminClient = createAdminClient();

    const { data: targetProfile, error: pErr } = await adminClient
      .from("profiles")
      .select("id, email, institution_id")
      .eq("id", userId)
      .single();

    if (pErr || !targetProfile || targetProfile.institution_id !== caller.institutionId) {
      return { success: false, error: "User record not found in your institution." };
    }

    const tempPassword = process.env.INITIAL_DEFAULT_PASSWORD || "CollegeERP@2026";
    const { error: resetErr } = await adminClient.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (resetErr) {
      return { success: false, error: resetErr.message || "Failed to reset password." };
    }

    await adminClient
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", userId);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to reset user password." };
  }
}

/**
 * Server Action: Grant or revoke Accounts Portal access for a specific staff member.
 */
export async function toggleUserAccountsAccessAction({
  userId,
  canAccess,
}: {
  userId: string;
  canAccess: boolean;
}): Promise<ActionResponse> {
  try {
    const caller = await requireRole(["admin"]);
    const adminClient = createAdminClient();

    const { data: targetProfile, error: pErr } = await adminClient
      .from("profiles")
      .select("id, role, institution_id")
      .eq("id", userId)
      .single();

    if (pErr || !targetProfile || targetProfile.institution_id !== caller.institutionId) {
      return { success: false, error: "User record not found in your institution." };
    }

    const { error: updErr } = await adminClient
      .from("profiles")
      .update({ can_access_accounts: canAccess })
      .eq("id", userId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update accounts access." };
  }
}

export type AccountInventoryItem = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  loginId: string | null;
  status: string;
  mustChangePassword: boolean;
  canAccessAccounts: boolean;
  isAuthLinked: boolean;
  departmentName?: string | null;
  employeeId?: string | null;
  rollNumber?: string | null;
  admissionNumber?: string | null;
};

/**
 * Server Action: Retrieve full account inventory for administrative governance.
 * Passwords and private tokens are strictly omitted.
 */
export async function getAdminAccountsInventoryAction(): Promise<{
  success: boolean;
  error?: string;
  accounts?: AccountInventoryItem[];
}> {
  try {
    const caller = await requireRole(["admin"]);
    const adminClient = createAdminClient();

    // 1. Fetch profiles
    const { data: profiles, error: pErr } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role, login_id, status, must_change_password, can_access_accounts")
      .eq("institution_id", caller.institutionId)
      .order("role", { ascending: true })
      .order("full_name", { ascending: true });

    if (pErr) {
      return { success: false, error: pErr.message };
    }

    // 2. Fetch auth user IDs
    const { data: authUsersResult } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const authUserSet = new Set((authUsersResult?.users || []).map((u) => u.id));

    // 3. Fetch teachers and department
    const { data: teachers } = await adminClient
      .from("teachers")
      .select(`
        id,
        employee_id,
        departments!fk_teachers_department (
          name
        )
      `)
      .eq("institution_id", caller.institutionId);

    const teacherMap = new Map(
      (teachers || []).map((t: any) => [
        t.id,
        { employeeId: t.employee_id, departmentName: t.departments?.name || null },
      ])
    );

    // 4. Fetch students and department
    const { data: students } = await adminClient
      .from("students")
      .select(`
        id,
        roll_number,
        admission_number,
        departments!fk_students_course (
          name
        )
      `)
      .eq("institution_id", caller.institutionId);

    const studentMap = new Map(
      (students || []).map((s: any) => [
        s.id,
        {
          rollNumber: s.roll_number,
          admissionNumber: s.admission_number,
          departmentName: s.departments?.name || null,
        },
      ])
    );

    const accounts: AccountInventoryItem[] = (profiles || []).map((p) => {
      const tData = teacherMap.get(p.id);
      const sData = studentMap.get(p.id);

      return {
        id: p.id,
        fullName: p.full_name,
        email: p.email,
        role: p.role,
        loginId: p.login_id,
        status: p.status,
        mustChangePassword: !!p.must_change_password,
        canAccessAccounts: !!p.can_access_accounts,
        isAuthLinked: authUserSet.has(p.id),
        departmentName: tData?.departmentName || sData?.departmentName || null,
        employeeId: tData?.employeeId || null,
        rollNumber: sData?.rollNumber || null,
        admissionNumber: sData?.admissionNumber || null,
      };
    });

    return { success: true, accounts };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to load account inventory." };
  }
}
