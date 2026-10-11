import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign In — College ERP",
  description: "Secure login portal for college students, faculty, and administrators",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading login portal...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
