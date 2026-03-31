"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ElementType,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Download,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  csvToTrades,
  jsonToThoughts,
  jsonToTrades,
  thoughtsToJSON,
  todayStamp,
  tradesToCSV,
  tradesToJSON,
  triggerDownload,
  type ParseResult,
} from "@/lib/io";
import { APP_USERS, type AppUserId, useAppUsers } from "@/store/useAppUsers";
import { usePortfolioSettings } from "@/store/usePortfolioSettings";
import { useThoughts } from "@/store/useThoughts";
import { useTrades } from "@/store/useTrades";
import type { Thought, Trade } from "@/types";

type Tab = "export" | "import";
type ImportFormat = "backup-json" | "trades-json" | "trades-csv" | "thoughts-json";
type ImportMode = "merge" | "overwrite";

type TradesByUser = Record<AppUserId, Trade[]>;
type ThoughtsByUser = Record<AppUserId, Thought[]>;
type SettingsByUser = Record<AppUserId, { initialCapital: number }>;

interface MultiUserBackup {
  version: 1;
  type: "multi-user-backup";
  exportedAt: string;
  activeUserId: AppUserId;
  users: typeof APP_USERS;
  tradesByUser: TradesByUser;
  thoughtsByUser: ThoughtsByUser;
  settingsByUser: SettingsByUser;
}

type ParsedPayload =
  | {
      kind: "items";
      format: Exclude<ImportFormat, "backup-json">;
      result: ParseResult<Trade | Thought>;
    }
  | {
      kind: "backup";
      format: "backup-json";
      backup: MultiUserBackup;
      warnings: string[];
    };

type ImportState =
  | { status: "idle" }
  | { status: "parsed"; payload: ParsedPayload }
  | { status: "error"; message: string }
  | { status: "done"; count: number; label: string };

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "border-b-2 -mb-px px-4 py-2 text-sm font-medium transition-colors",
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
  icon: ElementType;
  onJSON: () => void;
  onCSV?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3.5 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="shrink-0 rounded-lg bg-surface-3 p-2 text-text-muted">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{label}</p>
          <p className="mt-0.5 text-xs text-text-muted">{sub}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onJSON}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          <Download className="h-3 w-3" />
          JSON
        </button>
        {onCSV && (
          <button
            onClick={onCSV}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        )}
      </div>
    </div>
  );
}

function normalizeCapital(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(amount)) {
    return 100000;
  }

  return Math.round(Math.max(amount, 0) * 100) / 100;
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const existingIds = new Set(current.map((item) => item.id));
  const novel = incoming.filter((item) => !existingIds.has(item.id));
  return [...novel, ...current];
}

function buildEmptyTradesByUser(): TradesByUser {
  return {
    me: [],
    partner: [],
  };
}

function buildEmptyThoughtsByUser(): ThoughtsByUser {
  return {
    me: [],
    partner: [],
  };
}

function buildDefaultSettingsByUser(): SettingsByUser {
  return {
    me: { initialCapital: 100000 },
    partner: { initialCapital: 100000 },
  };
}

function parseBackup(text: string): { backup: MultiUserBackup; warnings: string[] } {
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("无法解析 JSON 文件");
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error("备份文件格式不正确");
  }

  const source = raw as Record<string, unknown>;
  const rawTradesByUser =
    typeof source.tradesByUser === "object" && source.tradesByUser !== null
      ? (source.tradesByUser as Record<string, unknown>)
      : {};
  const rawThoughtsByUser =
    typeof source.thoughtsByUser === "object" && source.thoughtsByUser !== null
      ? (source.thoughtsByUser as Record<string, unknown>)
      : {};
  const rawSettingsByUser =
    typeof source.settingsByUser === "object" && source.settingsByUser !== null
      ? (source.settingsByUser as Record<string, unknown>)
      : {};

  const tradesByUser = buildEmptyTradesByUser();
  const thoughtsByUser = buildEmptyThoughtsByUser();
  const settingsByUser = buildDefaultSettingsByUser();
  const warnings: string[] = [];

  APP_USERS.forEach((user) => {
    const tradeResult = jsonToTrades(JSON.stringify(rawTradesByUser[user.id] ?? []));
    const thoughtResult = jsonToThoughts(JSON.stringify(rawThoughtsByUser[user.id] ?? []));

    tradesByUser[user.id] = tradeResult.data;
    thoughtsByUser[user.id] = thoughtResult.data;

    warnings.push(...tradeResult.errors.map((error) => `${user.name} / 交易: ${error}`));
    warnings.push(...thoughtResult.errors.map((error) => `${user.name} / 笔记: ${error}`));

    const rawSetting =
      typeof rawSettingsByUser[user.id] === "object" && rawSettingsByUser[user.id] !== null
        ? (rawSettingsByUser[user.id] as Record<string, unknown>)
        : {};

    settingsByUser[user.id] = {
      initialCapital: normalizeCapital(rawSetting.initialCapital),
    };
  });

  const activeUserId = APP_USERS.some((user) => user.id === source.activeUserId)
    ? (source.activeUserId as AppUserId)
    : "me";

  return {
    backup: {
      version: 1,
      type: "multi-user-backup",
      exportedAt:
        typeof source.exportedAt === "string" ? source.exportedAt : new Date().toISOString(),
      activeUserId,
      users: APP_USERS,
      tradesByUser,
      thoughtsByUser,
      settingsByUser,
    },
    warnings,
  };
}

interface DataModalProps {
  open: boolean;
  onClose: () => void;
}

export function DataModal({ open, onClose }: DataModalProps) {
  const activeUserId = useAppUsers((state) => state.activeUserId);
  const setActiveUser = useAppUsers((state) => state.setActiveUser);
  const activeUser = APP_USERS.find((user) => user.id === activeUserId) ?? APP_USERS[0];

  const trades = useTrades((state) => state.trades);
  const tradesByUser = useTrades((state) => state.tradesByUser);
  const importTrades = useTrades((state) => state.importTrades);
  const mergeTrades = useTrades((state) => state.mergeTrades);
  const replaceAllTradesByUser = useTrades((state) => state.replaceAllTradesByUser);

  const thoughts = useThoughts((state) => state.thoughts);
  const thoughtsByUser = useThoughts((state) => state.thoughtsByUser);
  const importThoughts = useThoughts((state) => state.importThoughts);
  const mergeThoughts = useThoughts((state) => state.mergeThoughts);
  const replaceAllThoughtsByUser = useThoughts((state) => state.replaceAllThoughtsByUser);

  const settingsByUser = usePortfolioSettings((state) => state.settingsByUser);
  const replaceAllSettingsByUser = usePortfolioSettings((state) => state.replaceAllSettingsByUser);

  const [tab, setTab] = useState<Tab>("export");
  const [format, setFormat] = useState<ImportFormat>("backup-json");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalTrades = useMemo(
    () => APP_USERS.reduce((sum, user) => sum + (tradesByUser[user.id]?.length ?? 0), 0),
    [tradesByUser]
  );
  const totalThoughts = useMemo(
    () => APP_USERS.reduce((sum, user) => sum + (thoughtsByUser[user.id]?.length ?? 0), 0),
    [thoughtsByUser]
  );

  const handleExportBackupJSON = () => {
    const backup: MultiUserBackup = {
      version: 1,
      type: "multi-user-backup",
      exportedAt: new Date().toISOString(),
      activeUserId,
      users: APP_USERS,
      tradesByUser,
      thoughtsByUser,
      settingsByUser,
    };

    triggerDownload(
      JSON.stringify(backup, null, 2),
      `dogen-backup-${todayStamp()}.json`,
      "application/json"
    );
  };

  const handleExportTradesJSON = () => {
    triggerDownload(
      tradesToJSON(trades),
      `dogen-trades-${activeUserId}-${todayStamp()}.json`,
      "application/json"
    );
  };

  const handleExportTradesCSV = () => {
    triggerDownload(
      tradesToCSV(trades),
      `dogen-trades-${activeUserId}-${todayStamp()}.csv`,
      "text/csv"
    );
  };

  const handleExportThoughtsJSON = () => {
    triggerDownload(
      thoughtsToJSON(thoughts),
      `dogen-thoughts-${activeUserId}-${todayStamp()}.json`,
      "application/json"
    );
  };

  const processFile = useCallback(
    async (file: File) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const guessedFormat: ImportFormat =
        extension === "csv" ? "trades-csv" : format;

      const text = await file.text();

      try {
        if (guessedFormat === "backup-json") {
          const parsed = parseBackup(text);
          setImportState({
            status: "parsed",
            payload: {
              kind: "backup",
              format: "backup-json",
              backup: parsed.backup,
              warnings: parsed.warnings,
            },
          });
          return;
        }

        let result: ParseResult<Trade | Thought>;

        if (guessedFormat === "trades-json") {
          result = jsonToTrades(text) as ParseResult<Trade | Thought>;
        } else if (guessedFormat === "trades-csv") {
          result = csvToTrades(text) as ParseResult<Trade | Thought>;
        } else {
          result = jsonToThoughts(text) as ParseResult<Trade | Thought>;
        }

        if (result.data.length === 0 && result.errors.length > 0) {
          setImportState({ status: "error", message: result.errors[0] });
        } else {
          setImportState({
            status: "parsed",
            payload: {
              kind: "items",
              format: guessedFormat,
              result,
            },
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

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleConfirmImport = () => {
    if (importState.status !== "parsed") return;

    const payload = importState.payload;

    if (payload.kind === "items") {
      const count = payload.result.data.length;

      if (payload.format === "trades-json" || payload.format === "trades-csv") {
        const data = payload.result.data as Trade[];
        if (mode === "overwrite") {
          importTrades(data);
        } else {
          mergeTrades(data);
        }

        setImportState({ status: "done", count, label: `${activeUser.name}的交易记录` });
      } else {
        const data = payload.result.data as Thought[];
        if (mode === "overwrite") {
          importThoughts(data);
        } else {
          mergeThoughts(data);
        }

        setImportState({ status: "done", count, label: `${activeUser.name}的思考笔记` });
      }
    } else {
      const { backup } = payload;

      if (mode === "overwrite") {
        replaceAllTradesByUser(backup.tradesByUser);
        replaceAllThoughtsByUser(backup.thoughtsByUser);
      } else {
        const mergedTradesByUser = APP_USERS.reduce(
          (accumulator, user) => {
            accumulator[user.id] = mergeById(
              tradesByUser[user.id] ?? [],
              backup.tradesByUser[user.id] ?? []
            );
            return accumulator;
          },
          buildEmptyTradesByUser()
        );

        const mergedThoughtsByUser = APP_USERS.reduce(
          (accumulator, user) => {
            accumulator[user.id] = mergeById(
              thoughtsByUser[user.id] ?? [],
              backup.thoughtsByUser[user.id] ?? []
            );
            return accumulator;
          },
          buildEmptyThoughtsByUser()
        );

        replaceAllTradesByUser(mergedTradesByUser);
        replaceAllThoughtsByUser(mergedThoughtsByUser);
      }

      replaceAllSettingsByUser(backup.settingsByUser);
      setActiveUser(backup.activeUserId);

      const count =
        APP_USERS.reduce((sum, user) => sum + backup.tradesByUser[user.id].length, 0) +
        APP_USERS.reduce((sum, user) => sum + backup.thoughtsByUser[user.id].length, 0);

      setImportState({ status: "done", count, label: "完整双人数据包" });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetImport = () => {
    setImportState({ status: "idle" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetImport();
    onClose();
  };

  const handleFormatChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setFormat(event.target.value as ImportFormat);
    resetImport();
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
        <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-border bg-surface-1 shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-text-primary">本地数据管理</h2>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex shrink-0 border-b border-border px-5">
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
                <div className="mb-4 rounded-xl border border-border bg-surface-2/70 px-4 py-3 text-xs leading-5 text-text-muted">
                  所有导出文件都会直接下载到你当前设备，不会上传到服务器。你可以继续单独导出当前用户，
                  也可以直接导出一份完整双人备份包。
                </div>

                <ExportRow
                  label="完整双人数据包"
                  sub={`合并导出两位用户的交易、思考笔记和本金，共 ${totalTrades} 条交易 / ${totalThoughts} 条笔记`}
                  icon={FileArchive}
                  onJSON={handleExportBackupJSON}
                />
                <ExportRow
                  label={`${activeUser.name}的交易记录`}
                  sub={`${trades.length} 条交易，可单独导出为 JSON 或 CSV`}
                  icon={FileSpreadsheet}
                  onJSON={handleExportTradesJSON}
                  onCSV={handleExportTradesCSV}
                />
                <ExportRow
                  label={`${activeUser.name}的思考笔记`}
                  sub={`${thoughts.length} 条笔记，可单独导出为 JSON`}
                  icon={FileJson}
                  onJSON={handleExportThoughtsJSON}
                />
              </div>
            )}

            {tab === "import" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-surface-2/70 px-4 py-3 text-xs leading-5 text-text-muted">
                  导入文件只会在当前浏览器本地解析。完整双人备份会一次恢复两位用户的数据；单独交易或笔记文件只会导入到当前选中的用户。
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                    数据类型
                  </label>
                  <select
                    value={format}
                    onChange={handleFormatChange}
                    className="h-8 w-full appearance-none rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-text-primary focus:border-border-strong focus:outline-none"
                  >
                    <option value="backup-json">完整双人数据包 - JSON</option>
                    <option value="trades-json">交易记录 - JSON</option>
                    <option value="trades-csv">交易记录 - CSV</option>
                    <option value="thoughts-json">思考笔记 - JSON</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                    导入方式
                  </label>
                  <div className="flex gap-2">
                    {(["merge", "overwrite"] as ImportMode[]).map((item) => (
                      <button
                        key={item}
                        onClick={() => setMode(item)}
                        className={cn(
                          "flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors",
                          mode === item
                            ? "border-accent/30 bg-accent/10 text-accent"
                            : "border-border bg-surface-2 text-text-muted hover:border-border-strong"
                        )}
                      >
                        {item === "merge" ? "合并导入" : "覆盖导入"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-text-muted">
                    {format === "backup-json"
                      ? mode === "merge"
                        ? "双人备份会按用户分别合并交易和笔记，并同步更新两位用户的本金。"
                        : "双人备份会整体覆盖两位用户当前的交易、笔记和本金。"
                      : mode === "merge"
                      ? `保留${activeUser.name}当前的数据，只追加文件里的新记录。`
                      : `用文件内容直接替换${activeUser.name}当前这一类数据。`}
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
                      "relative flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors",
                      dragging
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-border-strong hover:bg-surface-2/50"
                    )}
                  >
                    <CloudUpload
                      className={cn("h-7 w-7", dragging ? "text-accent" : "text-text-muted")}
                    />
                    <p className="px-4 text-center text-xs text-text-muted">
                      <span className="font-medium text-text-secondary">点击选择本地文件</span>
                      {" "}或拖拽到这里
                      <br />
                      <span className="text-[11px]">支持 .json 和 .csv 文件</span>
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
                  <div className="flex items-start gap-2.5 rounded-lg border border-loss/20 bg-loss/10 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-loss" />
                    <p className="text-xs text-loss">{importState.message}</p>
                  </div>
                )}

                {importState.status === "parsed" && importState.payload.kind === "items" && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5 rounded-lg border border-profit/20 bg-profit/10 p-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-profit" />
                      <div className="text-xs text-profit">
                        <p className="font-medium">{importState.payload.result.data.length} 条记录准备导入</p>
                        {importState.payload.result.errors.length > 0 && (
                          <p className="mt-0.5 text-text-muted">
                            {importState.payload.result.errors.length} 条异常内容已跳过
                          </p>
                        )}
                      </div>
                    </div>

                    {importState.payload.result.errors.length > 0 && (
                      <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-2 p-3">
                        {importState.payload.result.errors.map((error, index) => (
                          <p key={index} className="font-mono text-[11px] text-text-muted">
                            <span className="text-loss">!</span> {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {importState.status === "parsed" &&
                  importState.payload.kind === "backup" &&
                  (() => {
                    const { backup, warnings } = importState.payload;
                    const totalItems = APP_USERS.reduce(
                      (sum, user) =>
                        sum + backup.tradesByUser[user.id].length + backup.thoughtsByUser[user.id].length,
                      0
                    );

                    return (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2.5 rounded-lg border border-profit/20 bg-profit/10 p-3">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-profit" />
                          <div className="text-xs text-profit">
                            <p className="font-medium">备份包已识别，共 {totalItems} 条数据</p>
                            <p className="mt-0.5 text-text-muted">
                              导入后会同步两位用户的交易、思考笔记和本金
                            </p>
                          </div>
                        </div>

                        <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-text-muted">
                          {APP_USERS.map((user) => (
                            <p key={user.id}>
                              {user.name}: {backup.tradesByUser[user.id].length} 条交易，
                              {backup.thoughtsByUser[user.id].length} 条笔记，
                              本金 {backup.settingsByUser[user.id].initialCapital}
                            </p>
                          ))}
                        </div>

                        {warnings.length > 0 && (
                          <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-2 p-3">
                            {warnings.map((warning, index) => (
                              <p key={index} className="font-mono text-[11px] text-text-muted">
                                <span className="text-accent">!</span> {warning}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {importState.status === "done" && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <CheckCircle2 className="h-10 w-10 text-profit" />
                    <p className="text-center text-sm font-medium text-text-primary">
                      已成功导入 {importState.count} 条{importState.label}
                    </p>
                    <button
                      onClick={resetImport}
                      className="text-xs text-text-muted underline hover:text-text-secondary"
                    >
                      继续导入另一份本地文件
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {tab === "import" && importState.status === "parsed" && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-4">
              <button
                onClick={resetImport}
                className="text-xs text-text-muted transition-colors hover:text-text-secondary"
              >
                取消
              </button>
              <Button
                variant="primary"
                size="sm"
                iconLeft={<Upload className="h-3.5 w-3.5" />}
                onClick={handleConfirmImport}
                disabled={
                  importState.payload.kind === "items"
                    ? importState.payload.result.data.length === 0
                    : false
                }
              >
                {importState.payload.kind === "items"
                  ? `导入 ${importState.payload.result.data.length} 条记录`
                  : "导入完整双人数据包"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
