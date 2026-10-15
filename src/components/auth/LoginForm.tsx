"use client";

import { useActionState } from "react";
import { signInAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Building2, Lock, Mail, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signInAction, { success: false });
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "";
  const errorParam = searchParams.get("error");
  const messageParam = searchParams.get("message");

  return (
    <Card className="w-full max-w-md bg-slate-900/90 border-slate-800 text-slate-100 shadow-2xl">
      <CardHeader className="space-y-2 text-center pb-6 border-b border-slate-800/80">
        <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-white">
          Sign In to ERP
        </CardTitle>
        <CardDescription className="text-slate-400 text-sm">
          Enter your academic credentials to access your portal
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4 pt-6">
          {errorParam === "account_inactive" && (
            <div className="p-3 text-xs bg-red-950/60 border border-red-800/60 text-red-300 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Your account is inactive or suspended. Please contact the administrator.</span>
            </div>
          )}

          {errorParam === "auth_service_unavailable" && (
            <div className="p-3 text-xs bg-amber-950/60 border border-amber-800/60 text-amber-300 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Authentication service was temporarily unreachable. Please sign in again.</span>
            </div>
          )}

          {messageParam === "password_updated" && (
            <div className="p-3 text-xs bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 rounded-lg flex items-center gap-2">
              <span>Your password has been successfully updated. Please sign in with your new password.</span>
            </div>
          )}

          {state?.error && (
            <div className="p-3 text-xs bg-red-950/60 border border-red-800/60 text-red-300 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <input type="hidden" name="redirectTo" value={redirectTo} />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address
            </label>
            <Input
              type="email"
              name="email"
              placeholder="e.g. faculty@college.edu"
              required
              disabled={isPending}
              className="bg-slate-950/60 border-slate-800 focus-visible:ring-indigo-500 text-slate-100"
            />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-red-400">{state.fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              type="password"
              name="password"
              placeholder="••••••••••••"
              required
              disabled={isPending}
              className="bg-slate-950/60 border-slate-800 focus-visible:ring-indigo-500 text-slate-100"
            />
            {state?.fieldErrors?.password && (
              <p className="text-xs text-red-400">{state.fieldErrors.password}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-2">
          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 shadow-lg shadow-indigo-600/20"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Verifying Credentials...
              </span>
            ) : (
              "Sign In to Account"
            )}
          </Button>

          <div className="text-center text-xs text-slate-500 pt-1">
            Need an account? Contact your college administration.
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
