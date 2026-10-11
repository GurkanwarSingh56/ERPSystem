"use server";

import { createClient } from "@/lib/supabase/server";
import { getRoleHomeDashboard } from "@/lib/auth/permissions";
import { UserRole } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  redirectTo: z.string().optional(),
});

export type ActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function signInAction(prevState: unknown, formData: FormData): Promise<ActionResponse> {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") || undefined,
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

  const { email, password, redirectTo } = parseResult.data;
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return {
      success: false,
      error: "Invalid email or password. Please check your credentials.",
    };
  }

  // Fetch verified profile status
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, status")
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

  redirect("/login?message=password_updated");
}
