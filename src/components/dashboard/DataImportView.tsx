"use client";

import { useState, useTransition, useMemo } from "react";
import { WizardStepKey, WIZARD_STEPS, WIZARD_STEPS_ORDER, getWizardTemplateContent } from "@/lib/csv/wizardEntities";
import { ImportEntity, ENTITY_DEFINITIONS, IMPORT_ORDER, getEntityTemplateContent } from "@/lib/csv/entities";
import {
  previewWizardImportAction,
  commitWizardImportAction,
  previewCsvImportAction,
  commitCsvImportAction,
  createAcademicEntityManualAction,
  CommitImportSummary,
} from "@/app/actions/import";
import { WizardPreviewResult } from "@/lib/csv/wizardValidator";
import { PreviewValidationResult } from "@/lib/csv/validator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Database,
  Layers,
  BookOpen,
  GraduationCap,
  Users,
  PlusCircle,
  ArrowRight,
  RefreshCw,
  Info,
  Calendar,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DataImportViewProps {
  departments: any[];
  courses: any[];
  semesters: any[];
  sections: any[];
  subjects: any[];
  teachers: any[];
  teacherAssignments?: any[];
  readinessSummary: {
    departmentsCount: number;
    coursesCount: number;
    semestersCount: number;
    sectionsCount: number;
    subjectsCount: number;
    teachersCount: number;
    teacherAssignmentsCount: number;
    studentsCount: number;
    readyForTimetable: boolean;
  };
}

export function DataImportView({
  departments,
  courses,
  semesters,
  sections,
  subjects,
  teachers,
  teacherAssignments = [],
  readinessSummary,
}: DataImportViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"wizard" | "advanced" | "manual">("wizard");

  // ==========================================
  // 4-STEP WIZARD STATES
  // ==========================================
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const currentStepKey = WIZARD_STEPS_ORDER[currentStepIndex];
  const currentStepDef = WIZARD_STEPS[currentStepKey];

  const [wizardFile, setWizardFile] = useState<File | null>(null);
  const [wizardCsvText, setWizardCsvText] = useState<string>("");
  const [wizardPreview, setWizardPreview] = useState<WizardPreviewResult | null>(null);
  const [wizardSummary, setWizardSummary] = useState<CommitImportSummary | null>(null);
  const [updateExisting, setUpdateExisting] = useState<boolean>(false);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("2026-2027");

  // Wizard Step Completion Cache
  const [stepCompletion, setStepCompletion] = useState<Record<WizardStepKey, boolean>>({
    step1_faculty: teachers.length > 0,
    step2_curriculum: subjects.length > 0,
    step3_students: readinessSummary.studentsCount > 0,
    step4_allocations: teacherAssignments.length > 0,
  });

  // ==========================================
  // ADVANCED / DIRECT CSV & MANUAL STATES
  // ==========================================
  const [selectedEntity, setSelectedEntity] = useState<ImportEntity>("departments");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [previewResult, setPreviewResult] = useState<PreviewValidationResult | null>(null);
  const [commitSummary, setCommitSummary] = useState<CommitImportSummary | null>(null);

  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual Entry States
  const [manualEntity, setManualEntity] = useState<"department" | "course" | "semester" | "section" | "subject">("department");
  const [manualDeptCode, setManualDeptCode] = useState("");
  const [manualDeptName, setManualDeptName] = useState("");
  const [manualCourseDeptId, setManualCourseDeptId] = useState("");
  const [manualCourseCode, setManualCourseCode] = useState("");
  const [manualCourseName, setManualCourseName] = useState("");
  const [manualCourseDuration, setManualCourseDuration] = useState("4");
  const [manualSemCourseId, setManualSemCourseId] = useState("");
  const [manualSemNumber, setManualSemNumber] = useState("1");
  const [manualSecCourseId, setManualSecCourseId] = useState("");
  const [manualSecSemId, setManualSecSemId] = useState("");
  const [manualSecName, setManualSecName] = useState("Section A");
  const [manualSubCourseId, setManualSubCourseId] = useState("");
  const [manualSubSemId, setManualSubSemId] = useState("");
  const [manualSubCode, setManualSubCode] = useState("");
  const [manualSubName, setManualSubName] = useState("");
  const [manualSubType, setManualSubType] = useState("theory");
  const [manualSubHours, setManualSubHours] = useState("4");

  // ------------------------------------------
  // Wizard Template Download
  // ------------------------------------------
  const handleDownloadWizardTemplate = (stepKey: WizardStepKey) => {
    const content = getWizardTemplateContent(stepKey);
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `template_${stepKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ------------------------------------------
  // Wizard File Selection & Reading
  // ------------------------------------------
  const handleWizardFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setWizardPreview(null);
    setWizardSummary(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      setErrorMsg("Please upload a valid CSV file (.csv).");
      return;
    }

    setWizardFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setWizardCsvText(text);
    };
    reader.readAsText(file);
  };

  // ------------------------------------------
  // Wizard Dry-Run Preview
  // ------------------------------------------
  const handleWizardDryRun = () => {
    if (!wizardCsvText) {
      setErrorMsg("Please upload or provide CSV content first.");
      return;
    }
    setErrorMsg(null);

    startTransition(async () => {
      const res = await previewWizardImportAction(currentStepKey, wizardCsvText, {
        updateExisting,
        academicYear: selectedAcademicYear,
      });

      if (!res.success || !res.data) {
        setErrorMsg(res.error || "Failed to validate CSV file.");
      } else {
        setWizardPreview(res.data);
      }
    });
  };

  // ------------------------------------------
  // Wizard Commit Import
  // ------------------------------------------
  const handleWizardCommit = () => {
    if (!wizardCsvText) return;
    setErrorMsg(null);

    startTransition(async () => {
      const res = await commitWizardImportAction(currentStepKey, wizardCsvText, {
        updateExisting,
        academicYear: selectedAcademicYear,
      });

      if (!res.success || !res.data) {
        setErrorMsg(res.error || "Failed to commit import.");
      } else {
        setWizardSummary(res.data);
        setStepCompletion((prev) => ({
          ...prev,
          [currentStepKey]: true,
        }));
        router.refresh();
      }
    });
  };

  // ------------------------------------------
  // Download Validation Errors as CSV
  // ------------------------------------------
  const handleDownloadErrorCsv = () => {
    if (!wizardPreview || wizardPreview.rows.length === 0) return;
    const errorRows = wizardPreview.rows.filter((r) => !r.isValid);
    if (errorRows.length === 0) return;

    const headers = ["row_number", "errors", ...Object.keys(errorRows[0].data)];
    const escape = (val: string) => `"${(val || "").replace(/"/g, '""')}"`;

    const lines = [
      headers.join(","),
      ...errorRows.map((r) => [
        r.rowNumber,
        escape(r.errors.join("; ")),
        ...Object.keys(errorRows[0].data).map((k) => escape(r.data[k] || "")),
      ].join(",")),
    ];

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `errors_${currentStepKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ------------------------------------------
  // Manual Entity Creation Handler
  // ------------------------------------------
  const handleManualCreate = () => {
    setErrorMsg(null);
    startTransition(async () => {
      let payload: any = {};
      if (manualEntity === "department") {
        payload = { code: manualDeptCode, name: manualDeptName };
      } else if (manualEntity === "course") {
        payload = { departmentId: manualCourseDeptId, code: manualCourseCode, name: manualCourseName, durationYears: manualCourseDuration };
      } else if (manualEntity === "semester") {
        payload = { courseId: manualSemCourseId, semesterNumber: manualSemNumber };
      } else if (manualEntity === "section") {
        payload = { courseId: manualSecCourseId, semesterId: manualSecSemId, name: manualSecName };
      } else if (manualEntity === "subject") {
        payload = { courseId: manualSubCourseId, semesterId: manualSubSemId, code: manualSubCode, name: manualSubName, type: manualSubType, weeklyHours: manualSubHours };
      }

      const res = await createAcademicEntityManualAction(manualEntity, payload);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to create record.");
      } else {
        alert("Record created successfully!");
        if (manualEntity === "department") { setManualDeptCode(""); setManualDeptName(""); }
        if (manualEntity === "course") { setManualCourseCode(""); setManualCourseName(""); }
        if (manualEntity === "subject") { setManualSubCode(""); setManualSubName(""); }
        router.refresh();
      }
    });
  };

  // Step Status Determiner
  const getStepStatus = (index: number) => {
    const key = WIZARD_STEPS_ORDER[index];
    if (stepCompletion[key]) return "completed";
    if (index === currentStepIndex) return "active";
    // Check prerequisites
    const prevKey = WIZARD_STEPS_ORDER[index - 1];
    if (index > 0 && !stepCompletion[prevKey]) return "locked";
    return "ready";
  };

  return (
    <div className="space-y-6">
      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab("wizard")}
          className={`px-4 py-2 font-medium text-xs flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "wizard"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          4-Step Onboarding Wizard
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`px-4 py-2 font-medium text-xs flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "manual"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          Manual Quick Entry
        </button>
      </div>

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="p-3 bg-red-950/60 border border-red-800 rounded-md flex items-center gap-2 text-red-200 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4-STEP IMPORT WIZARD VIEW */}
      {/* ======================================================== */}
      {activeTab === "wizard" && (
        <div className="space-y-6">
          {/* STEPPER PROGRESS BAR */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {WIZARD_STEPS_ORDER.map((sKey, idx) => {
              const def = WIZARD_STEPS[sKey];
              const status = getStepStatus(idx);
              const isCurrent = idx === currentStepIndex;

              return (
                <div
                  key={sKey}
                  onClick={() => {
                    setCurrentStepIndex(idx);
                    setWizardFile(null);
                    setWizardCsvText("");
                    setWizardPreview(null);
                    setWizardSummary(null);
                    setErrorMsg(null);
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isCurrent
                      ? "bg-slate-900 border-indigo-500 shadow-md shadow-indigo-950/50"
                      : status === "completed"
                      ? "bg-slate-950 border-emerald-900/60 hover:border-emerald-700"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Step {def.step}
                    </span>
                    {status === "completed" ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> Ready
                      </span>
                    ) : isCurrent ? (
                      <Badge variant="outline" className="text-[10px] border-indigo-500 text-indigo-400">
                        In Progress
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-slate-500">Pending</span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-100 truncate">{def.title}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{def.subtitle}</div>
                </div>
              );
            })}
          </div>

          {/* ACTIVE STEP CARD */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800/80 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-indigo-600 text-white font-mono text-[10px]">
                      STEP {currentStepDef.step} OF 4
                    </Badge>
                    <CardTitle className="text-base font-semibold text-white">
                      {currentStepDef.title}
                    </CardTitle>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{currentStepDef.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadWizardTemplate(currentStepKey)}
                    className="border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-200 text-xs h-8"
                  >
                    <Download className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                    Download CSV Template
                  </Button>
                </div>
              </div>

              {/* CONTEXT CONTROLS */}
              <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Academic Year Context:</span>
                  <Input
                    value={selectedAcademicYear}
                    onChange={(e) => setSelectedAcademicYear(e.target.value)}
                    className="h-7 w-32 bg-slate-950 border-slate-800 text-xs text-slate-200 font-mono"
                    placeholder="2026-2027"
                  />
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={updateExisting}
                      onChange={(e) => setUpdateExisting(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0"
                    />
                    <span>Update existing records if found</span>
                  </label>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* FILE UPLOAD & PREVIEW TRIGGER */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>Upload CSV Data File</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Required Headers: {currentStepDef.requiredHeaders.join(", ")}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleWizardFileChange}
                      className="bg-slate-950 border-slate-800 text-slate-300 text-xs file:bg-slate-800 file:text-slate-200 file:border-0 file:rounded file:text-xs file:px-2 file:mr-2"
                    />
                    <Button
                      onClick={handleWizardDryRun}
                      disabled={!wizardCsvText || isPending}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs whitespace-nowrap h-9"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          Dry-Run Preview
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* TEMPLATE QUICK REFERENCE */}
                <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-md text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    Template Columns
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 break-all">
                    {currentStepDef.requiredHeaders.join(", ")}
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1">
                    Sample: {Object.values(currentStepDef.exampleRow).slice(0, 4).join(", ")}
                  </div>
                </div>
              </div>

              {/* DRY-RUN PREVIEW RESULTS */}
              {wizardPreview && (
                <div className="space-y-4 pt-2">
                  <div className="p-3 rounded-lg border bg-slate-950 border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-slate-500">Total Rows:</span>{" "}
                        <span className="font-mono font-semibold text-slate-200">{wizardPreview.totalRows}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Valid:</span>{" "}
                        <span className="font-mono font-semibold text-emerald-400">{wizardPreview.validRowsCount}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Errors:</span>{" "}
                        <span className="font-mono font-semibold text-red-400">{wizardPreview.invalidRowsCount}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {wizardPreview.invalidRowsCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDownloadErrorCsv}
                          className="border-red-900 bg-red-950/40 text-red-300 hover:bg-red-900/60 text-xs h-8"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download Error CSV
                        </Button>
                      )}

                      <Button
                        size="sm"
                        disabled={wizardPreview.validRowsCount === 0 || isPending}
                        onClick={handleWizardCommit}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-8 px-4"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            Committing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Confirm & Commit ({wizardPreview.validRowsCount} Rows)
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* AUTO-CREATION NOTICES */}
                  {wizardPreview.detectedDepartmentsToCreate && wizardPreview.detectedDepartmentsToCreate.length > 0 && (
                    <div className="p-2.5 bg-indigo-950/40 border border-indigo-800/60 rounded text-xs text-indigo-300 flex items-center gap-2">
                      <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <span>
                        Notice: {wizardPreview.detectedDepartmentsToCreate.length} missing department(s) will be auto-created:{" "}
                        <strong>{wizardPreview.detectedDepartmentsToCreate.join(", ")}</strong>.
                      </span>
                    </div>
                  )}

                  {/* WORKLOAD WARNINGS */}
                  {wizardPreview.workloadWarnings && wizardPreview.workloadWarnings.length > 0 && (
                    <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded text-xs text-amber-300 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        Teaching Workload Warnings:
                      </div>
                      <ul className="list-disc list-inside text-[11px] space-y-0.5 text-amber-200/90 pl-1">
                        {wizardPreview.workloadWarnings.slice(0, 5).map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* PREVIEW ROWS TABLE */}
                  <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-72">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                        <tr>
                          <th className="py-2 px-3 w-16">Row #</th>
                          <th className="py-2 px-3 w-24">Status</th>
                          <th className="py-2 px-3 w-24">Action</th>
                          <th className="py-2 px-3">Data Summary</th>
                          <th className="py-2 px-3">Diagnostics & Validation Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        {wizardPreview.rows.slice(0, 50).map((r) => (
                          <tr key={r.rowNumber} className={!r.isValid ? "bg-red-950/15" : ""}>
                            <td className="py-2 px-3 font-mono text-slate-400">{r.rowNumber}</td>
                            <td className="py-2 px-3">
                              {r.isValid ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                                  <CheckCircle className="w-3 h-3" /> Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-400 text-[11px]">
                                  <XCircle className="w-3 h-3" /> Error
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  r.action === "create"
                                    ? "border-emerald-700 text-emerald-400"
                                    : r.action === "update"
                                    ? "border-amber-700 text-amber-400"
                                    : "border-slate-700 text-slate-400"
                                }`}
                              >
                                {r.action.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-300">
                              {Object.entries(r.data)
                                .slice(0, 3)
                                .map(([k, v]) => `${k}:${v}`)
                                .join(" | ")}
                            </td>
                            <td className="py-2 px-3 text-[11px]">
                              {r.errors.length > 0 && (
                                <div className="text-red-400">{r.errors.join("; ")}</div>
                              )}
                              {r.warnings.length > 0 && (
                                <div className="text-amber-400">{r.warnings.join("; ")}</div>
                              )}
                              {r.isValid && r.warnings.length === 0 && (
                                <span className="text-slate-500">Ready for commit</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* POST COMMIT REPORT */}
              {wizardSummary && (
                <div className="p-4 bg-slate-950 border border-emerald-900/60 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                      <CheckCircle className="w-4 h-4" />
                      Step {currentStepDef.step} Import Completed
                    </div>
                    {currentStepIndex < WIZARD_STEPS_ORDER.length - 1 && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setCurrentStepIndex((prev) => prev + 1);
                          setWizardFile(null);
                          setWizardCsvText("");
                          setWizardPreview(null);
                          setWizardSummary(null);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-7"
                      >
                        Proceed to Step {currentStepDef.step + 1}
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">Total Processed</div>
                      <div className="font-mono font-semibold text-slate-200 mt-0.5">{wizardSummary.totalProcessed}</div>
                    </div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">Created</div>
                      <div className="font-mono font-semibold text-emerald-400 mt-0.5">{wizardSummary.createdCount}</div>
                    </div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">Updated</div>
                      <div className="font-mono font-semibold text-amber-400 mt-0.5">{wizardSummary.updatedCount}</div>
                    </div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">Skipped / Failed</div>
                      <div className="font-mono font-semibold text-slate-400 mt-0.5">
                        {wizardSummary.skippedCount + wizardSummary.failedCount}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* TIMETABLE READINESS SUMMARY */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3 border-b border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    Timetable Onboarding Readiness Status
                  </CardTitle>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Real-time status of academic prerequisites required for smart timetable generation.
                  </p>
                </div>
                {readinessSummary.readyForTimetable ? (
                  <Link href="/dashboard/admin/timetable">
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8">
                      Open Timetable Generator
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                ) : (
                  <Badge variant="outline" className="border-amber-600/70 text-amber-400 text-xs">
                    Prerequisites Incomplete
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                  <div className="text-slate-500 text-[11px]">Departments</div>
                  <div className="text-lg font-bold font-mono text-slate-100 mt-1">{readinessSummary.departmentsCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Step 1</div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                  <div className="text-slate-500 text-[11px]">Active Faculty</div>
                  <div className="text-lg font-bold font-mono text-slate-100 mt-1">{readinessSummary.teachersCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Step 1 Master</div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                  <div className="text-slate-500 text-[11px]">Curricular Subjects</div>
                  <div className="text-lg font-bold font-mono text-slate-100 mt-1">{readinessSummary.subjectsCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Step 2 Catalog</div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                  <div className="text-slate-500 text-[11px]">Class Sections</div>
                  <div className="text-lg font-bold font-mono text-slate-100 mt-1">{readinessSummary.sectionsCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Step 3 Roster</div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                  <div className="text-slate-500 text-[11px]">Teaching Allocations</div>
                  <div className="text-lg font-bold font-mono text-indigo-400 mt-1">{readinessSummary.teacherAssignmentsCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Step 4 Matrix</div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                  <div className="text-slate-500 text-[11px]">Enrolled Students</div>
                  <div className="text-lg font-bold font-mono text-slate-100 mt-1">{readinessSummary.studentsCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Step 3 Cohorts</div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg col-span-2">
                  <div className="text-slate-500 text-[11px]">Timetable Prerequisites</div>
                  <div className="text-xs font-medium mt-1">
                    {readinessSummary.readyForTimetable ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> All sections & allocations configured
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Complete Steps 1-4 to enable scheduling
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* MANUAL QUICK ENTRY TAB */}
      {/* ======================================================== */}
      {activeTab === "manual" && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3 border-b border-slate-800">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-indigo-400" />
              Manual Academic Record Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["department", "course", "semester", "section", "subject"] as const).map((ent) => (
                <button
                  key={ent}
                  onClick={() => setManualEntity(ent)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                    manualEntity === ent
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {ent}
                </button>
              ))}
            </div>

            {manualEntity === "department" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 mb-1 block">
                    Department Code <span className="text-red-400">*</span>
                  </label>
                  <Input
                    placeholder="e.g. CSE"
                    value={manualDeptCode}
                    onChange={(e) => setManualDeptCode(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">
                    Department Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Computer Science and Engineering"
                    value={manualDeptName}
                    onChange={(e) => setManualDeptName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
              </div>
            )}

            {manualEntity === "course" && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-slate-400 mb-1 block">
                    Parent Department <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={manualCourseDeptId}
                    onChange={(e) => setManualCourseDeptId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                  {departments.length === 0 && (
                    <p className="text-[10px] text-amber-400 mt-1">Please create a Department first.</p>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">
                    Course Code <span className="text-red-400">*</span>
                  </label>
                  <Input
                    placeholder="e.g. BTECH-CSE"
                    value={manualCourseCode}
                    onChange={(e) => setManualCourseCode(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">
                    Duration (Years) <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="number"
                    value={manualCourseDuration}
                    onChange={(e) => setManualCourseDuration(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-slate-400 mb-1 block">
                    Course Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Bachelor of Technology in Computer Science"
                    value={manualCourseName}
                    onChange={(e) => setManualCourseName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
              </div>
            )}

            {manualEntity === "semester" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 mb-1 block">
                    Parent Course <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={manualSemCourseId}
                    onChange={(e) => setManualSemCourseId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                  >
                    <option value="">Select Course Program...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                  {courses.length === 0 && (
                    <p className="text-[10px] text-amber-400 mt-1">Please create a Course first.</p>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">
                    Semester Number (1-12) <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={manualSemNumber}
                    onChange={(e) => setManualSemNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                      <option key={num} value={num.toString()}>
                        Semester {num}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {manualEntity === "section" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 mb-1 block">
                    Parent Course <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={manualSecCourseId}
                    onChange={(e) => {
                      setManualSecCourseId(e.target.value);
                      setManualSecSemId("");
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                  >
                    <option value="">Select Course...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                  {courses.length === 0 && (
                    <p className="text-[10px] text-amber-400 mt-1">Please create a Course first.</p>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">
                    Semester <span className="text-red-400">*</span>
                  </label>
                  <select
                    disabled={!manualSecCourseId}
                    value={manualSecSemId}
                    onChange={(e) => setManualSecSemId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 disabled:opacity-50"
                  >
                    <option value="">
                      {!manualSecCourseId ? "Select Course first..." : "Select Semester..."}
                    </option>
                    {semesters
                      .filter((s) => s.course_id === manualSecCourseId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          Semester {s.semester_number}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">
                    Section Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Section A"
                    value={manualSecName}
                    onChange={(e) => setManualSecName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
              </div>
            )}

            {manualEntity === "subject" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 mb-1 block">
                    Parent Course <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={manualSubCourseId}
                    onChange={(e) => {
                      setManualSubCourseId(e.target.value);
                      setManualSubSemId("");
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                  >
                    <option value="">Select Course...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                  {courses.length === 0 && (
                    <p className="text-[10px] text-amber-400 mt-1">Please create a Course first.</p>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">
                    Semester <span className="text-red-400">*</span>
                  </label>
                  <select
                    disabled={!manualSubCourseId}
                    value={manualSubSemId}
                    onChange={(e) => setManualSubSemId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 disabled:opacity-50"
                  >
                    <option value="">
                      {!manualSubCourseId ? "Select Course first..." : "Select Semester..."}
                    </option>
                    {semesters
                      .filter((s) => s.course_id === manualSubCourseId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          Semester {s.semester_number}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">
                    Subject Code <span className="text-red-400">*</span>
                  </label>
                  <Input
                    placeholder="e.g. CS501"
                    value={manualSubCode}
                    onChange={(e) => setManualSubCode(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-slate-400 mb-1 block">
                    Subject Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Database Systems"
                    value={manualSubName}
                    onChange={(e) => setManualSubName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Type</label>
                  <select
                    value={manualSubType}
                    onChange={(e) => setManualSubType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                  >
                    <option value="theory">Theory</option>
                    <option value="practical">Practical / Lab</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Weekly Hours (Periods)</label>
                  <Input
                    type="number"
                    value={manualSubHours}
                    onChange={(e) => setManualSubHours(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleManualCreate}
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <PlusCircle className="w-3.5 h-3.5 mr-1" />}
              Create Record
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
