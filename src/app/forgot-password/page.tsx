"use client";

import { useActionState } from "react";
import { resetPasswordRequestAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { KeyRound, Mail, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(resetPasswordRequestAction, { success: false });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      <Card className="w-full max-w-md bg-slate-900/90 border-slate-800 text-slate-100 shadow-2xl">
        <CardHeader className="space-y-2 text-center pb-6 border-b border-slate-800/80">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            Reset Password
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Enter your account email to receive a secure recovery link
          </CardDescription>
        </CardHeader>

        {state?.success ? (
          <CardContent className="pt-6 space-y-4 text-center">
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-sm font-medium text-emerald-200">
                Recovery Request Submitted
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                If an account matches that email address, an instructions link has been dispatched. Please inspect your inbox.
              </p>
            </div>
            <Link href="/login" className="inline-flex items-center text-xs text-indigo-400 hover:text-indigo-300 gap-1.5 pt-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Sign In
            </Link>
          </CardContent>
        ) : (
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
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> Account Email
                </label>
                <Input
                  type="email"
                  name="email"
                  placeholder="e.g. yourname@college.edu"
                  required
                  disabled={isPending}
                  className="bg-slate-950/60 border-slate-800 focus-visible:ring-indigo-500 text-slate-100"
                />
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
                    <Loader2 className="w-4 h-4 animate-spin" /> Dispatching Link...
                  </span>
                ) : (
                  "Send Password Recovery Link"
                )}
              </Button>

              <Link
                href="/login"
                className="inline-flex items-center justify-center text-xs text-slate-400 hover:text-slate-200 gap-1 pt-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
