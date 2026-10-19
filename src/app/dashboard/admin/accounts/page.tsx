import { requireRole } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { getAdminAccountsInventoryAction } from "@/app/actions/auth";
import { AdminAccountsView } from "@/components/dashboard/AdminAccountsView";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export const metadata = {
  title: "Account Provisioning & Credentials — College ERP",
};

export default async function AdminAccountsPage() {
  const user = await requireRole(["admin"]);
  const inventoryResult = await getAdminAccountsInventoryAction();
  const accounts = inventoryResult.accounts || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono">
              <Link href="/dashboard/admin" className="hover:underline flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin Overview
              </Link>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-400" />
              Account Provisioning & Credential Governance
            </h1>
            <p className="text-slate-400 text-xs">
              Manage institutional login IDs, automated Auth user provisioning, password resets, and accounts delegation.
            </p>
          </div>
        </div>

        <AdminAccountsView initialAccounts={accounts} />
      </main>
    </div>
  );
}
