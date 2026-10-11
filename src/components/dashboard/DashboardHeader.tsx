import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, LogOut, UserCircle } from "lucide-react";
import { AuthContextUser } from "@/lib/auth/roles";

export function DashboardHeader({ user }: { user: AuthContextUser }) {
  const roleBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "success" | "warning"> = {
    admin: "destructive",
    principal: "warning",
    hod: "secondary",
    teacher: "default",
    student: "secondary",
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
            <span className="text-sm font-medium text-slate-200">{user.fullName || user.email}</span>
            <span className="text-xs text-slate-400 font-mono">{user.email}</span>
          </div>

          <Badge variant={roleBadgeVariant[user.role] || "default"} className="uppercase font-mono text-[10px] tracking-wider px-2.5 py-0.5">
            {user.role}
          </Badge>

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
