"use client";

import { useActionState, Suspense } from "react";
import { updatePasswordAction, signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ShieldCheck, Lock, AlertCircle, Loader2, KeyRound } from "lucide-react";
import { useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePasswordAction, { success: false });
  const searchParams = useSearchParams();
  const isRequired = searchParams.get("required") === "true";

  return (
    <Card className="w-full max-w-md bg-slate-900/90 border-slate-800 text-slate-100 shadow-2xl">
      <CardHeader className="space-y-2 text-center pb-6 border-b border-slate-800/80">
        <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-white">
          {isRequired ? "Choose Your New Password" : "Set New Password"}
        </CardTitle>
        <CardDescription className="text-slate-400 text-sm">
          {isRequired
            ? "Your account requires an immediate password update before accessing ERP modules"
            : "Enter and confirm your new secure password"}
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4 pt-6">
          {isRequired && (
            <div className="p-3 text-xs bg-amber-950/60 border border-amber-800/60 text-amber-200 rounded-lg flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-semibold block text-amber-300">First-Time Setup Required</span>
                <span>
                  For institutional security, please replace the temporary password with a secure personal password of at least 8 characters.
                </span>
              </div>
            </div>
          )}

          {state?.error && (
            <div className="p-3 text-xs bg-red-950/60 border border-red-800/60 text-red-300 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" /> New Password
            </label>
            <Input
              type="password"
              name="password"
              placeholder="At least 8 characters"
              required
              disabled={isPending}
              className="bg-slate-950/60 border-slate-800 focus-visible:ring-indigo-500 text-slate-100"
            />
            {state?.fieldErrors?.password && (
              <p className="text-xs text-red-400">{state.fieldErrors.password}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" /> Confirm New Password
            </label>
            <Input
              type="password"
              name="confirmPassword"
              placeholder="Re-type password"
              required
              disabled={isPending}
              className="bg-slate-950/60 border-slate-800 focus-visible:ring-indigo-500 text-slate-100"
            />
            {state?.fieldErrors?.confirmPassword && (
              <p className="text-xs text-red-400">{state.fieldErrors.confirmPassword}</p>
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
                <Loader2 className="w-4 h-4 animate-spin" /> Updating Credentials...
              </span>
            ) : (
              "Save New Password & Continue"
            )}
          </Button>

          <div className="text-center text-xs text-slate-500 pt-1">
            <form action={signOutAction} className="inline">
              <button type="submit" className="text-slate-400 hover:text-slate-300 underline">
                Sign out and return to login
              </button>
            </form>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading security portal...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
