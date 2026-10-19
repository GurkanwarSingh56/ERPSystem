"use client";

import { useState, useTransition } from "react";
import {
  AccountInventoryItem,
  provisionAccountsAction,
  adminResetUserPasswordAction,
  toggleUserAccountsAccessAction,
  ProvisionAccountsResponse,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Users,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Search,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Building2,
  Landmark,
} from "lucide-react";

interface AdminAccountsViewProps {
  initialAccounts: AccountInventoryItem[];
}

export function AdminAccountsView({ initialAccounts }: AdminAccountsViewProps) {
  const [accounts, setAccounts] = useState<AccountInventoryItem[]>(initialAccounts);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [provisionResult, setProvisionResult] = useState<ProvisionAccountsResponse | null>(null);
  const [isProvisioning, startProvisioning] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // Filter accounts
  const filtered = accounts.filter((acc) => {
    if (selectedRole !== "all" && acc.role !== selectedRole) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      acc.fullName.toLowerCase().includes(q) ||
      acc.email.toLowerCase().includes(q) ||
      (acc.loginId && acc.loginId.toLowerCase().includes(q)) ||
      (acc.employeeId && acc.employeeId.toLowerCase().includes(q)) ||
      (acc.rollNumber && acc.rollNumber.toLowerCase().includes(q))
    );
  });

  const totalCount = accounts.length;
  const teacherCount = accounts.filter((a) => a.role === "teacher" || a.role === "hod" || a.role === "principal").length;
  const studentCount = accounts.filter((a) => a.role === "student").length;
  const provisionedCount = accounts.filter((a) => a.loginId && a.isAuthLinked).length;
  const missingLoginIdCount = accounts.filter((a) => !a.loginId).length;

  const handleRunProvisioning = () => {
    setActionMessage(null);
    startProvisioning(async () => {
      const res = await provisionAccountsAction();
      setProvisionResult(res);
      if (res.success && res.details) {
        // Update local accounts with new login IDs
        const detailMap = new Map(res.details.map((d) => [d.id, d.loginId]));
        setAccounts((prev) =>
          prev.map((acc) => {
            const newId = detailMap.get(acc.id);
            if (newId) {
              return { ...acc, loginId: newId, isAuthLinked: true };
            }
            return acc;
          })
        );
        setActionMessage({
          type: "success",
          text: `Account provisioning completed: ${res.summary?.provisionedCount || 0} provisioned, ${res.summary?.skippedCount || 0} skipped, ${res.summary?.failedCount || 0} failed.`,
        });
      } else if (res.error) {
        setActionMessage({ type: "error", text: res.error });
      }
    });
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to reset credentials for ${userName}? They will be required to choose a new password upon next login.`)) {
      return;
    }
    setPendingUserId(userId);
    setActionMessage(null);
    try {
      const res = await adminResetUserPasswordAction({ userId });
      if (res.success) {
        setAccounts((prev) =>
          prev.map((acc) => (acc.id === userId ? { ...acc, mustChangePassword: true } : acc))
        );
        setActionMessage({
          type: "success",
          text: `Temporary credentials set for ${userName}. First-login password change has been enforced.`,
        });
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to reset password." });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Failed to reset password." });
    } finally {
      setPendingUserId(null);
    }
  };

  const handleToggleAccountsAccess = async (userId: string, currentAccess: boolean, userName: string) => {
    const nextAccess = !currentAccess;
    setPendingUserId(userId);
    setActionMessage(null);
    try {
      const res = await toggleUserAccountsAccessAction({ userId, canAccess: nextAccess });
      if (res.success) {
        setAccounts((prev) =>
          prev.map((acc) => (acc.id === userId ? { ...acc, canAccessAccounts: nextAccess } : acc))
        );
        setActionMessage({
          type: "success",
          text: `${nextAccess ? "Granted" : "Revoked"} Accounts Portal access for ${userName}.`,
        });
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to update accounts access." });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Failed to update accounts access." });
    } finally {
      setPendingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Accounts</CardTitle>
            <Users className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalCount}</div>
            <p className="text-xs text-slate-500 pt-1 font-mono">
              {teacherCount} Teachers &bull; {studentCount} Students
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Provisioned Login IDs</CardTitle>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{provisionedCount}</div>
            <p className="text-xs text-slate-500 pt-1 font-mono">
              {missingLoginIdCount > 0 ? `${missingLoginIdCount} unassigned` : "100% Assigned"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Accounts Delegations</CardTitle>
            <Landmark className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">
              {accounts.filter((a) => a.canAccessAccounts).length}
            </div>
            <p className="text-xs text-slate-500 pt-1">Staff with Cashier Portal access</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Pending Setup</CardTitle>
            <KeyRound className="w-4 h-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-400">
              {accounts.filter((a) => a.mustChangePassword).length}
            </div>
            <p className="text-xs text-slate-500 pt-1">Require first-login password change</p>
          </CardContent>
        </Card>
      </div>

      {/* Action / Provisioning Card */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="sm:flex sm:flex-row sm:items-center sm:justify-between pb-4">
          <div>
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              Automated Account Provisioning
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs pt-1">
              Scans all institutional teacher and student records, assigns unique Login IDs from employee IDs and roll numbers, links missing Auth accounts, and skips already provisioned users.
            </CardDescription>
          </div>
          <div className="mt-4 sm:mt-0">
            <Button
              onClick={handleRunProvisioning}
              disabled={isProvisioning}
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 font-medium"
            >
              {isProvisioning ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Provisioning Accounts...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Run Account Provisioning
                </span>
              )}
            </Button>
          </div>
        </CardHeader>

        {actionMessage && (
          <div
            className={`mx-6 mb-4 p-3 rounded-lg text-xs flex items-center gap-2.5 ${
              actionMessage.type === "success"
                ? "bg-emerald-950/60 border border-emerald-800/60 text-emerald-300"
                : "bg-red-950/60 border border-red-800/60 text-red-300"
            }`}
          >
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {provisionResult?.summary && (
          <div className="mx-6 mb-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
              <span className="text-slate-300 font-medium">Provisioning Run Summary:</span>
              <div className="flex items-center gap-4">
                <span className="text-slate-400 font-mono">
                  Scanned: <strong className="text-slate-200">{provisionResult.summary.totalScanned}</strong>
                </span>
                <span className="text-emerald-400 font-mono">
                  Provisioned: <strong>{provisionResult.summary.provisionedCount}</strong>
                </span>
                <span className="text-indigo-400 font-mono">
                  Skipped (Idempotent): <strong>{provisionResult.summary.skippedCount}</strong>
                </span>
                <span className="text-red-400 font-mono">
                  Failed: <strong>{provisionResult.summary.failedCount}</strong>
                </span>
              </div>
            </div>
            {provisionResult.details && provisionResult.details.some((d) => d.status === "failed") && (
              <div className="pt-2 border-t border-slate-800/80">
                <p className="text-[11px] font-semibold text-red-400 mb-1">Failed Records:</p>
                <ul className="text-[11px] text-red-300 space-y-1">
                  {provisionResult.details
                    .filter((d) => d.status === "failed")
                    .map((d) => (
                      <li key={d.id}>
                        &bull; {d.name} ({d.role}): {d.reason}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search by name, email, login ID, roll #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900/90 border-slate-800 text-slate-100 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {["all", "teacher", "student", "cashier", "admin"].map((r) => (
            <Button
              key={r}
              variant={selectedRole === r ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedRole(r)}
              className={`text-xs uppercase font-mono tracking-wider ${
                selectedRole === r
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                  : "border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      {/* Account Inventory Table */}
      <Card className="bg-slate-900/80 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">User & Contact</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Login ID</th>
                <th className="px-4 py-3">Institutional Identifier</th>
                <th className="px-4 py-3">Security & Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No account records match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100">{acc.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{acc.email}</div>
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          acc.role === "admin"
                            ? "destructive"
                            : acc.role === "cashier"
                            ? "success"
                            : "secondary"
                        }
                        className="uppercase font-mono text-[10px]"
                      >
                        {acc.role}
                      </Badge>
                      {acc.canAccessAccounts && acc.role !== "cashier" && acc.role !== "admin" && (
                        <div className="pt-1">
                          <span className="text-[10px] text-amber-300 font-mono bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
                            + Accounts Access
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {acc.loginId ? (
                        <span className="font-mono text-xs font-semibold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60">
                          {acc.loginId}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Not Assigned</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {acc.employeeId && <div>EMP: {acc.employeeId}</div>}
                      {acc.rollNumber && <div>Roll: {acc.rollNumber}</div>}
                      {acc.admissionNumber && <div>Adm: {acc.admissionNumber}</div>}
                      {acc.departmentName && (
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                          {acc.departmentName}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        {acc.mustChangePassword ? (
                          <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
                            First-Login Pending
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                            Password Verified
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono">
                          {acc.status === "active" ? "Active" : "Suspended"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right space-x-2">
                      {/* Allow toggling accounts access for faculty / staff */}
                      {(acc.role === "teacher" || acc.role === "hod") && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingUserId === acc.id}
                          onClick={() => handleToggleAccountsAccess(acc.id, acc.canAccessAccounts, acc.fullName)}
                          className={`text-[11px] h-7 px-2 border-slate-800 ${
                            acc.canAccessAccounts
                              ? "bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 border-amber-800/50"
                              : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          }`}
                        >
                          {acc.canAccessAccounts ? "Revoke Accounts" : "Grant Accounts"}
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingUserId === acc.id}
                        onClick={() => handleResetPassword(acc.id, acc.fullName)}
                        className="text-[11px] h-7 px-2 border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white"
                      >
                        {pendingUserId === acc.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Reset Password"
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
