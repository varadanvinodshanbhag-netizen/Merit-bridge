import { useState, useRef } from "react";
import { X, Upload, CheckCircle2, AlertCircle, FileSpreadsheet, ArrowRight } from "lucide-react";
import clsx from "clsx";
import {
  parseFileToRawJson,
  validateStudentRows,
  commitStudentImport,
  STUDENT_FIELD_ALIASES,
  ImportPreviewResult,
  DuplicatePolicy,
} from "@/services/importer";
import { useAuthStore } from "@/store/auth";

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

export function ImportModal({ onClose, onSuccess }: Props) {
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"UPLOAD" | "MAP" | "PREVIEW" | "SUCCESS">("UPLOAD");
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>("Skip");
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [importStats, setImportStats] = useState<{ imported: number; updated: number; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetFields = [
    { key: "registration_number", label: "Registration No *", required: true },
    { key: "full_name", label: "Full Name *", required: true },
    { key: "course", label: "Course / Degree", required: false },
    { key: "department", label: "Department / Branch", required: false },
    { key: "batch", label: "Batch (e.g. 2021-2025)", required: false },
    { key: "passing_year", label: "Passing Year *", required: true },
    { key: "email", label: "Email Address", required: false },
    { key: "phone", label: "Phone Number", required: false },
    { key: "gender", label: "Gender", required: false },
    { key: "cgpa", label: "CGPA (0 - 10)", required: false },
  ];

  // 1. File Upload Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    try {
      const { data } = await parseFileToRawJson(selectedFile);
      if (data.length === 0) {
        throw new Error("The uploaded spreadsheet has no data rows.");
      }

      setFile(selectedFile);
      setRawRows(data);
      const cols = Object.keys(data[0]);
      setSourceColumns(cols);

      // Auto-suggest mapping using aliases (PRD 10.1)
      const initialMap: Record<string, string> = {};
      for (const field of targetFields) {
        const aliases = STUDENT_FIELD_ALIASES[field.key] || [field.key];
        const match = cols.find((c) => {
          const norm = c.toLowerCase().replace(/[^a-z0-9]/g, "");
          return (
            aliases.some((a) => norm === a.replace(/[^a-z0-9]/g, "")) ||
            norm.includes(field.key.replace(/[^a-z0-9]/g, ""))
          );
        });
        if (match) initialMap[field.key] = match;
      }
      setColumnMap(initialMap);
      setStep("MAP");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to read file: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. Validate & Run Preview
  const handleProceedToPreview = () => {
    // Validate required fields are mapped
    if (!columnMap["registration_number"] || !columnMap["full_name"]) {
      setError("Registration Number and Full Name are mandatory and must be mapped.");
      return;
    }
    setError(null);

    const prevResult = validateStudentRows(rawRows, columnMap, duplicatePolicy);
    setPreview(prevResult);
    setStep("PREVIEW");
  };

  // 3. Commit Import
  const handleCommit = () => {
    if (!preview) return;
    setLoading(true);
    try {
      const stats = commitStudentImport(
        preview,
        duplicatePolicy,
        user?.id || 1,
        user?.name || "Placement Staff"
      );
      setImportStats(stats);
      setStep("SUCCESS");
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Commit failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
      <div className="flex flex-col w-full max-w-3xl max-h-[90vh] rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#12151d] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-light)] text-[var(--color-brand)]">
              <FileSpreadsheet size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Import Students from Excel
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Supports .xlsx, .xls and .csv with auto-mapping and duplicate control
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 p-3 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === "UPLOAD" && (
            <div className="space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-[var(--color-brand)] p-10 text-center cursor-pointer transition-all duration-200 bg-slate-50/50 dark:bg-slate-900/30"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 shadow-sm text-slate-500 group-hover:text-[var(--color-brand)] group-hover:scale-110 transition-all duration-200">
                  <Upload size={24} />
                </span>
                <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Click to select spreadsheet or drag and drop here
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  .xlsx, .xls or .csv (UTF-8 encoded)
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 p-4">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Required columns:
                </p>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  Registration Number, Full Name, Passing Year. Optional: Email, Phone, Course, Department, Batch, CGPA.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === "MAP" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Step 2: Map Columns
                  </h3>
                  <p className="text-xs text-slate-500">
                    Map Excel columns from <span className="font-semibold text-slate-800 dark:text-slate-200">{file?.name}</span> ({rawRows.length} rows found)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Duplicate Policy:
                  </label>
                  <select
                    value={duplicatePolicy}
                    onChange={(e) => setDuplicatePolicy(e.target.value as DuplicatePolicy)}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20"
                  >
                    <option value="Skip">Skip duplicates (Default)</option>
                    <option value="Update">Update existing records</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {targetFields.map((field) => (
                  <div
                    key={field.key}
                    className="flex flex-col justify-between rounded-xl border border-slate-200/70 dark:border-slate-800/80 p-3 bg-white dark:bg-slate-900/60"
                  >
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {field.label}
                    </label>
                    <select
                      value={columnMap[field.key] || ""}
                      onChange={(e) =>
                        setColumnMap((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                    >
                      <option value="">-- Do not import --</option>
                      {sourceColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === "PREVIEW" && preview && (
            <div className="space-y-5">
              {/* Summary pills */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200/60 dark:border-slate-800">
                  <p className="text-[10px] uppercase font-semibold text-slate-400">Total Rows</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{preview.totalRows}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3 border border-emerald-200/60 dark:border-emerald-900/40">
                  <p className="text-[10px] uppercase font-semibold text-emerald-600">Valid</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{preview.validCount}</p>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200/60 dark:border-amber-900/40">
                  <p className="text-[10px] uppercase font-semibold text-amber-600">Duplicates</p>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{preview.duplicateCount}</p>
                </div>
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 p-3 border border-rose-200/60 dark:border-rose-900/40">
                  <p className="text-[10px] uppercase font-semibold text-rose-600">Invalid</p>
                  <p className="text-xl font-bold text-rose-700 dark:text-rose-400">{preview.invalidCount}</p>
                </div>
              </div>

              {/* Preview table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Row</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Reg No</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Details / Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {preview.rows.slice(0, 100).map((r) => (
                      <tr key={r.rowNumber} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 text-slate-400 font-mono">{r.rowNumber}</td>
                        <td className="px-3 py-2">
                          <span
                            className={clsx(
                              "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              r.status === "Valid" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
                              r.status === "Duplicate" && "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
                              r.status === "Invalid" && "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                            )}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono font-medium text-slate-700 dark:text-slate-300">
                          {String(r.mapped.registration_number || "-")}
                        </td>
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                          {String(r.mapped.full_name || "-")}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {r.reasons.length > 0 ? r.reasons.join(", ") : "OK"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === "SUCCESS" && importStats && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 shadow-sm">
                <CheckCircle2 size={32} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Import Completed Successfully
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Data committed into MeritBridge database in a single atomic transaction.
                </p>
              </div>

              <div className="flex gap-4 mt-2">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-center">
                  <p className="text-[10px] uppercase text-slate-400 font-semibold">Imported</p>
                  <p className="text-lg font-bold text-emerald-600">{importStats.imported}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-center">
                  <p className="text-[10px] uppercase text-slate-400 font-semibold">Updated</p>
                  <p className="text-lg font-bold text-blue-600">{importStats.updated}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-center">
                  <p className="text-[10px] uppercase text-slate-400 font-semibold">Skipped</p>
                  <p className="text-lg font-bold text-slate-400">{importStats.skipped}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30">
          {step === "MAP" && (
            <button
              onClick={() => setStep("UPLOAD")}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white transition-colors"
            >
              Back
            </button>
          )}

          {step === "PREVIEW" && (
            <button
              onClick={() => setStep("MAP")}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white transition-colors"
            >
              Change Mapping
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {step === "MAP" && (
              <button
                onClick={handleProceedToPreview}
                className="flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)] shadow-sm transition-colors"
              >
                Preview Rows
                <ArrowRight size={14} />
              </button>
            )}

            {step === "PREVIEW" && (
              <button
                onClick={handleCommit}
                disabled={loading || (preview?.validCount === 0 && preview?.duplicateCount === 0)}
                className="flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-6 py-2 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)] shadow-sm disabled:opacity-50 transition-colors"
              >
                {loading ? "Committing..." : "Commit Import"}
              </button>
            )}

            {step === "SUCCESS" && (
              <button
                onClick={onClose}
                className="rounded-xl bg-[var(--color-brand)] px-6 py-2 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)] shadow-sm transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
