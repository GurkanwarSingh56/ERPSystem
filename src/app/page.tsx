import Link from "next/link";
import { 
  Building2, 
  GraduationCap, 
  UserCheck, 
  BookOpen, 
  CalendarCheck, 
  Receipt, 
  BarChart3, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Database,
  Layers,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://placeholder.supabase.co"
  );

  const modules = [
    { name: "Authentication & RBAC", phase: "Phase 3", status: "Ready for Dev", icon: ShieldCheck },
    { name: "Student Management", phase: "Phase 4", status: "Planned", icon: GraduationCap },
    { name: "Faculty Management", phase: "Phase 5", status: "Planned", icon: UserCheck },
    { name: "Academic Structure", phase: "Phase 6", status: "Planned", icon: BookOpen },
    { name: "Attendance System", phase: "Phase 7", status: "Planned", icon: CalendarCheck },
    { name: "Fee Tracking & Receipts", phase: "Phase 8", status: "Planned", icon: Receipt },
    { name: "Marks & Grading", phase: "Phase 9", status: "Planned", icon: BarChart3 },
    { name: "Role Dashboards", phase: "Phase 10", status: "Planned", icon: Layers },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">College ERP</span>
              <span className="ml-2 text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono border border-indigo-500/30">
                MVP v1.0
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant={isSupabaseConfigured ? "success" : "warning"} className="font-medium gap-1 px-3 py-1">
              {isSupabaseConfigured ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Supabase Connected
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5" /> Supabase Template Active
                </>
              )}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="text-indigo-400 border-indigo-500/30 bg-indigo-950/40">
            Phase 1 Complete — Core Platform Engine
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Academic Administration & Management System
          </h1>
          <p className="text-base sm:text-lg text-slate-400 font-normal leading-relaxed">
            A simple, high-performance and secure web ERP built with Next.js, Supabase, PostgreSQL, and Tailwind CSS.
          </p>
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="gap-2 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/25">
                Sign In to Portal <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-300">
                Go to Dashboard
              </Button>
            </Link>
          </div>

        </div>

        {/* Status Banner */}
        <div className="mb-12">
          <Card className="bg-slate-900/80 border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-slate-800/80 bg-slate-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Database className="h-5 w-5 text-indigo-400" />
                  <CardTitle className="text-lg font-semibold text-white">
                    Supabase Infrastructure & SSR Environment Status
                  </CardTitle>
                </div>
                <Badge variant="outline" className="border-slate-700 text-slate-300">
                  Phase 1 Verified
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400 font-mono">Framework & Router</div>
                <div className="text-base font-semibold text-slate-200">Next.js App Router (v16)</div>
                <p className="text-xs text-slate-500">TypeScript & Tailwind CSS v4 Engine</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400 font-mono">Auth & Data Access</div>
                <div className="text-base font-semibold text-slate-200">@supabase/ssr Helpers</div>
                <p className="text-xs text-slate-500">Cookie-based SSR session management</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400 font-mono">Security Model</div>
                <div className="text-base font-semibold text-slate-200">Row Level Security (RLS)</div>
                <p className="text-xs text-slate-500">Server-side strict role checking</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modules Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-white">System Architecture & Modules</h2>
            <span className="text-xs text-slate-400">12-Phase MVP Implementation Order</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((mod, idx) => {
              const Icon = mod.icon;
              return (
                <Card 
                  key={idx} 
                  className="bg-slate-900/50 border-slate-800 hover:border-indigo-500/50 transition-all duration-200 group"
                >
                  <CardHeader className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
                        <Icon className="h-5 w-5 text-indigo-400" />
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 font-mono">
                        {mod.phase}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-medium text-slate-200 group-hover:text-white transition-colors">
                      {mod.name}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 pt-1">
                      {mod.status}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          College ERP MVP — Built with Next.js, Supabase, PostgreSQL & Tailwind CSS
        </div>
      </footer>
    </div>
  );
}
