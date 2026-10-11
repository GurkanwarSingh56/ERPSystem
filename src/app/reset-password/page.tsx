"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ShieldCheck, Lock, AlertCircle, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(updatePasswordAction, { success: false });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      <Card className="w-full max-w-md bg-slate-900/90 border-slate-800 text-slate-100 shadow-2xl">
        <CardHeader className="space-y-2 text-center pb-6 border-b border-slate-800/80">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            Set New Password
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Enter and confirm your new secure password
          </CardDescription>
        </CardHeader>

        <form action={formAction}>
          <CardContent className="space-y-4 pt-6">
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
                "Save New Password"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
