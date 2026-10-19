import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, LogOut, UserCircle, Landmark } from "lucide-react";
import { AuthContextUser } from "@/lib/auth/roles";
import Link from "next/link";

export function DashboardHeader({ user }: { user: AuthContextUser }) {
  const roleBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "success" | "warning"> = {
    admin: "destructive",
    principal: "warning",
    hod: "secondary",
    teacher: "default",
    student: "secondary",
    cashier: "success",
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">College ERP</span>
            <span className="ml-2 text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono border border-indigo-500/30">
              Campus Portal
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex flex-col text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-sm font-medium text-slate-200">{user.fullName || user.email}</span>
              {user.loginId && (
                <span className="text-[10px] bg-slate-800 text-indigo-300 font-mono px-1.5 py-0.2 rounded border border-slate-700">
                  {user.loginId}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 font-mono">{user.email}</span>
          </div>

          <Badge variant={roleBadgeVariant[user.role] || "default"} className="uppercase font-mono text-[10px] tracking-wider px-2.5 py-0.5">
            {user.role}
          </Badge>

          {user.canAccessAccounts && user.role !== "cashier" && user.role !== "admin" && (
            <Link
              href="/dashboard/cashier"
              className="hidden md:inline-flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-md transition-colors font-medium"
            >
              <Landmark className="w-3.5 h-3.5" /> Accounts Portal
            </Link>
          )}

          <form action={signOutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="border-slate-800 hover:bg-slate-800 text-slate-300 gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
