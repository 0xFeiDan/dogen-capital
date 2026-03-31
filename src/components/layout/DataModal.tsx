"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Download,
  FileJson,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useThoughts } from "@/store/useThoughts";
import { useTrades } from "@/store/useTrades";
import {
  csvToTrades,
  jsonToThoughts,
  jsonToTrades,
  thoughtsToJSON,
  todayStamp,
  tradesToCSV,
  tradesToJSON,
  triggerDownload,
} from "@/lib/io";
import type { ParseResult } from "@/lib/io";
import type { Thought, Trade } from "@/types";

type Tab = "export" | "import";
type ImportFormat = "trades-json" | "trades-csv" | "thoughts-json";
type ImportMode = "merge" | "overwrite";

type ImportState =
  | { status: "idle" }
  | { status: "parsed"; format: ImportFormat; result: ParseResult<Trade | Thought> }
  | { status: "error"; message: string }
  | { status: "done"; count: number };

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
        active ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text-secondary"
      )}
    >
      {children}
    </button>
  );
}

function ExportRow({
  label,
  sub,
  icon: Icon,
  onJSON,
  onCSV,
}: {
  label: string;
  sub: string;
  icon: React.ElementType;
  onJSON: () => void;
  onCSV?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-border last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-surface-3 text-text-muted shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{label}</p>
          <p className="text-xs text-text-muted mt-0.5">{sub}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onJSON}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-3 border border-border text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
        >
          <Download className="w-3 h-3" />
          JSON
        </button>
        {onCSV && (
          <button
            onClick={onCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-3 border border-border text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        )}
      </div>
    </div>
  );
}

interface DataModalProps {
  open: boolean;
  onClose: () => void;
}

export function DataModal({ open, onClose }: DataModalProps) {
  const trades = useTrades((state) => state.trades);
  const { importTrades, mergeTrades } = useTrades();
  const thoughts = useThoughts((state) => state.thoughts);
  const { importThoughts, mergeThoughts } = useThoughts();

  const [tab, setTab] = useState<Tab>("export");
  const [format, setFormat] = useState<ImportFormat>("trades-json");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportTradesJSON = () => {
    triggerDownload(
      tradesToJSON(trades),
      `dogen-trades-${todayStamp()}.json`,
      "application/json"
    );
  };

  const handleExportTradesCSV = () => {
    triggerDownload(
      tradesToCSV(trades),
      `dogen-trades-${todayStamp()}.csv`,
      "text/csv"
    );
  };

  const handleExportThoughtsJSON = () => {
    triggerDownload(
      thoughtsToJSON(thoughts),
      `dogen-thoughts-${todayStamp()}.json`,
      "application/json"
    );
  };

  const processFile = useCallback(
    async (file: File) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension === "csv") {
        setFormat("trades-csv");
      }

      const text = await file.text();
      const effectiveFormat = extension === "csv" ? "trades-csv" : format;

      try {
        let result: ParseResult<Trade | Thought>;

        if (effectiveFormat === "trades-json") {
          result = jsonToTrades(text) as ParseResult<Trade | Thought>;
        } else if (effectiveFormat === "trades-csv") {
          result = csvToTrades(text) as ParseResult<Trade | Thought>;
        } else {
          result = jsonToThoughts(text) as ParseResult<Trade | Thought>;
        }

        if (result.data.length === 0 && result.errors.length > 0) {
          setImportState({ status: "error", message: result.errors[0] });
        } else {
          setImportState({
            status: "parsed",
            format: effectiveFormat,
            result,
          });
        }
      } catch (error) {
        setImportState({
          status: "error",
          message: `解析文件失败: ${(error as Error).message}`,
        });
      }
    },
    [format]
  );

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setImportState({ status: "idle" });
    processFile(files[0]);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleConfirmImport = () => {
    if (importState.status !== "parsed") return;

    const { format: effectiveFormat, result } = importState;
    const count = result.data.length;

    if (effectiveFormat === "trades-json" || effectiveFormat === "trades-csv") {
      const data = result.data as Trade[];
      if (mode === "overwrite") importTrades(data);
      else mergeTrades(data);
    } else {
      const data = result.data as Thought[];
      if (mode === "overwrite") importThoughts(data);
      else mergeThoughts(data);
    }

    setImportState({ status: "done", count });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetImport = () => {
    setImportState({ status: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    resetImport();
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface-1 border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <h2 className="text-sm font-semibold text-text-primary">本地数据管理</h2>
            <button
              onClick={handleClose}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex border-b border-border px-5 shrink-0">
            <TabButton active={tab === "export"} onClick={() => setTab("export")}>
              导出到本地
            </TabButton>
            <TabButton
              active={tab === "import"}
              onClick={() => {
                setTab("import");
                resetImport();
              }}
            >
              从本地导入
            </TabButton>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {tab === "export" && (
              <div>
                <div className="rounded-xl border border-border bg-surface-2/70 px-4 py-3 text-xs text-text-muted mb-4 leading-5">
                  所有导出文件都会直接下载到你当前设备，本过程不会上传到服务器。
                </div>

                <ExportRow
                  label="交易记录"
                  sub={`${trades.length} 条交易，支持导出到本地 JSON 或 CSV`}
                  icon={FileSpreadsheet}
                  onJSON={handleExportTradesJSON}
                  onCSV={handleExportTradesCSV}
                />
                <ExportRow
                  label="思考笔记"
                  sub={`${thoughts.length} 条笔记，支持导出到本地 JSON`}
                  icon={FileJson}
                  onJSON={handleExportThoughtsJSON}
                />
              </div>
            )}

            {tab === "import" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-surface-2/70 px-4 py-3 text-xs text-text-muted leading-5">
                  导入文件只会在当前浏览器本地解析。你可以从本地选择
                  ` .json `或` .csv `文件，CSV 仅支持交易记录。
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    数据类型
                  </label>
                  <select
                    value={format}
                    onChange={(event) => {
                      setFormat(event.target.value as ImportFormat);
                      resetImport();
                    }}
                    className="w-full h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-text-primary appearance-none focus:outline-none focus:border-border-strong"
                  >
                    <option value="trades-json">交易记录 - JSON</option>
                    <option value="trades-csv">交易记录 - CSV</option>
                    <option value="thoughts-json">思考笔记 - JSON</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    导入方式
                  </label>
                  <div className="flex gap-2">
                    {(["merge", "overwrite"] as ImportMode[]).map((item) => (
                      <button
                        key={item}
                        onClick={() => setMode(item)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                          mode === item
                            ? "bg-accent/10 border-accent/30 text-accent"
                            : "bg-surface-2 border-border text-text-muted hover:border-border-strong"
                        )}
                      >
                        {item === "merge" ? "合并导入" : "覆盖导入"}
                      </button>
                    ))}
                  </div>
                  <p className="text-2xs text-text-muted mt-1.5">
                    {mode === "merge"
                      ? "保留现有数据，只追加新的记录。"
                      : "用导入文件直接替换当前这一类数据。"}
                  </p>
                </div>

                {importState.status !== "done" && (
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
                      dragging
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-border-strong hover:bg-surface-2/50"
                    )}
                  >
                    <CloudUpload
                      className={cn(
                        "w-7 h-7",
                        dragging ? "text-accent" : "text-text-muted"
                      )}
                    />
                    <p className="text-xs text-text-muted text-center px-4">
                      <span className="text-text-secondary font-medium">
                        点击选择本地文件
                      </span>
                      {" "}或拖拽到这里
                      <br />
                      <span className="text-2xs">支持 .json 和 .csv 文件</span>
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.csv"
                      className="hidden"
                      onChange={(event) => handleFiles(event.target.files)}
                    />
                  </div>
                )}

                {importState.status === "error" && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-loss/10 border border-loss/20">
                    <AlertCircle className="w-4 h-4 text-loss shrink-0 mt-0.5" />
                    <p className="text-xs text-loss">{importState.message}</p>
                  </div>
                )}

                {importState.status === "parsed" && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-profit/10 border border-profit/20">
                      <CheckCircle2 className="w-4 h-4 text-profit shrink-0 mt-0.5" />
                      <div className="text-xs text-profit">
                        <p className="font-medium">
                          {importState.result.data.length} 条记录准备导入
                        </p>
                        {importState.result.errors.length > 0 && (
                          <p className="text-text-muted mt-0.5">
                            {importState.result.errors.length} 行已跳过
                          </p>
                        )}
                      </div>
                    </div>

                    {importState.result.errors.length > 0 && (
                      <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-1 max-h-28 overflow-y-auto">
                        {importState.result.errors.map((error, index) => (
                          <p key={index} className="text-2xs text-text-muted font-mono">
                            <span className="text-loss">!</span> {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {importState.status === "done" && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <CheckCircle2 className="w-10 h-10 text-profit" />
                    <p className="text-sm font-medium text-text-primary">
                      已成功导入 {importState.count} 条记录
                    </p>
                    <button
                      onClick={resetImport}
                      className="text-xs text-text-muted hover:text-text-secondary underline"
                    >
                      继续导入另一个本地文件
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {tab === "import" && importState.status === "parsed" && (
            <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-4 border-t border-border">
              <button
                onClick={resetImport}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                取消
              </button>
              <Button
                variant="primary"
                size="sm"
                iconLeft={<Upload className="w-3.5 h-3.5" />}
                onClick={handleConfirmImport}
                disabled={importState.result.data.length === 0}
              >
                导入 {importState.result.data.length} 条记录
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
