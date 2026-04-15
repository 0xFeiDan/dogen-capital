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
  type ParseResult,
} from "@/lib/io";
import {
  downloadServerExport,
  importBackupToServer,
  importItemsToServer,
  setActiveUserId,
  syncServerSnapshot,
} from "@/lib/server-sync-client";
import type { DcaByUser, SettingsByUser, ThoughtsByUser, TradesByUser } from "@/lib/server-data";
import { APP_USERS, isAppUserId, type AppUserId } from "@/lib/users";
import { useAppUsers } from "@/store/useAppUsers";
import { usePortfolioSettings } from "@/store/usePortfolioSettings";
import { useThoughts } from "@/store/useThoughts";
import { useTrades } from "@/store/useTrades";
import type { DcaEntry, Thought, Trade } from "@/types";

type Tab = "export" | "import";
type ImportFormat = "backup-json" | "trades-json" | "trades-csv" | "thoughts-json";
type ImportMode = "merge" | "overwrite";

type ParsedPayload =
  | {
      kind: "items";
      format: Exclude<ImportFormat, "backup-json">;
      result: ParseResult<Trade | Thought>;
    }
  | {
      kind: "backup";
      format: "backup-json";
    backup: {
      tradesByUser: TradesByUser;
      thoughtsByUser: ThoughtsByUser;
      dcaByUser: DcaByUser;
      settingsByUser: SettingsByUser;
      activeUserId?: AppUserId;
    };
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
  loading = false,
}: {
  label: string;
  sub: string;
  icon: ElementType;
  onJSON: () => void;
  onCSV?: () => void;
  loading?: boolean;
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
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
        >
          <Download className="h-3 w-3" />
          JSON
        </button>
        {onCSV && (
          <button
            onClick={onCSV}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        )}
      </div>
    </div>
  );
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

function buildEmptyDcaByUser(): DcaByUser {
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

function normalizeCapital(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(amount)) return 100000;
  return Math.round(Math.max(amount, 0) * 100) / 100;
}

function parseDcaEntries(value: unknown): ParseResult<DcaEntry> {
  if (!Array.isArray(value)) {
    return { data: [], errors: [] };
  }

  const data: DcaEntry[] = [];
  const errors: string[] = [];

  value.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      errors.push(`DCA #${index + 1} invalid`);
      return;
    }

    const entry = item as Partial<DcaEntry>;
    if (
      typeof entry.id !== "string" ||
      typeof entry.ticker !== "string" ||
      (entry.assetClass !== "stock" && entry.assetClass !== "crypto") ||
      typeof entry.currency !== "string" ||
      typeof entry.investedAt !== "string" ||
      typeof entry.investedAmount !== "number" ||
      !Number.isFinite(entry.investedAmount) ||
      entry.investedAmount <= 0 ||
      typeof entry.quantity !== "number" ||
      !Number.isFinite(entry.quantity) ||
      entry.quantity <= 0 ||
      typeof entry.createdAt !== "string" ||
      typeof entry.updatedAt !== "string"
    ) {
      errors.push(`DCA #${index + 1} invalid`);
      return;
    }

    data.push({
      id: entry.id,
      ticker: entry.ticker.trim().toUpperCase(),
      name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : undefined,
      assetClass: entry.assetClass,
      currency: entry.currency,
      investedAt: entry.investedAt,
      investedAmount: entry.investedAmount,
      quantity: entry.quantity,
      currentPrice:
        typeof entry.currentPrice === "number" && Number.isFinite(entry.currentPrice)
          ? entry.currentPrice
          : undefined,
      quoteSymbol:
        typeof entry.quoteSymbol === "string" && entry.quoteSymbol.trim()
          ? entry.quoteSymbol.trim().toUpperCase()
          : undefined,
      quoteCurrency:
        typeof entry.quoteCurrency === "string" && entry.quoteCurrency.trim()
          ? (entry.quoteCurrency as DcaEntry["quoteCurrency"])
          : undefined,
      priceUpdatedAt:
        typeof entry.priceUpdatedAt === "string" && entry.priceUpdatedAt.trim()
          ? entry.priceUpdatedAt
          : undefined,
      notes: typeof entry.notes === "string" && entry.notes.trim() ? entry.notes.trim() : undefined,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    });
  });

  return { data, errors };
}

function parseBackup(text: string): ParsedPayload & { kind: "backup" } {
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
  const rawDcaByUser =
    typeof source.dcaByUser === "object" && source.dcaByUser !== null
      ? (source.dcaByUser as Record<string, unknown>)
      : {};
  const rawSettingsByUser =
    typeof source.settingsByUser === "object" && source.settingsByUser !== null
      ? (source.settingsByUser as Record<string, unknown>)
      : {};

  const tradesByUser = buildEmptyTradesByUser();
  const thoughtsByUser = buildEmptyThoughtsByUser();
  const dcaByUser = buildEmptyDcaByUser();
  const settingsByUser = buildDefaultSettingsByUser();
  const warnings: string[] = [];

  APP_USERS.forEach((user) => {
    const tradeResult = jsonToTrades(JSON.stringify(rawTradesByUser[user.id] ?? []));
    const thoughtResult = jsonToThoughts(JSON.stringify(rawThoughtsByUser[user.id] ?? []));
    const dcaResult = parseDcaEntries(rawDcaByUser[user.id] ?? []);

    tradesByUser[user.id] = tradeResult.data;
    thoughtsByUser[user.id] = thoughtResult.data;
    dcaByUser[user.id] = dcaResult.data;

    warnings.push(...tradeResult.errors.map((error) => `${user.name} / 交易: ${error}`));
    warnings.push(...thoughtResult.errors.map((error) => `${user.name} / 笔记: ${error}`));
    warnings.push(...dcaResult.errors.map((error) => `${user.name} / DCA: ${error}`));

    const rawSetting =
      typeof rawSettingsByUser[user.id] === "object" && rawSettingsByUser[user.id] !== null
        ? (rawSettingsByUser[user.id] as Record<string, unknown>)
        : {};

    settingsByUser[user.id] = {
      initialCapital: normalizeCapital(rawSetting.initialCapital),
    };
  });

  return {
    kind: "backup",
    format: "backup-json",
    backup: {
      tradesByUser,
      thoughtsByUser,
      dcaByUser,
      settingsByUser,
      activeUserId: isAppUserId(source.activeUserId) ? source.activeUserId : undefined,
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
  const activeUser = APP_USERS.find((user) => user.id === activeUserId) ?? APP_USERS[0];
  const tradesByUser = useTrades((state) => state.tradesByUser);
  const thoughtsByUser = useThoughts((state) => state.thoughtsByUser);
  const settingsByUser = usePortfolioSettings((state) => state.settingsByUser);

  const [tab, setTab] = useState<Tab>("export");
  const [format, setFormat] = useState<ImportFormat>("backup-json");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalTrades = useMemo(
    () => APP_USERS.reduce((sum, user) => sum + (tradesByUser[user.id]?.length ?? 0), 0),
    [tradesByUser]
  );
  const totalThoughts = useMemo(
    () => APP_USERS.reduce((sum, user) => sum + (thoughtsByUser[user.id]?.length ?? 0), 0),
    [thoughtsByUser]
  );

  const handleExport = async (
    type: "backup-json" | "trades-json" | "trades-csv" | "thoughts-json"
  ) => {
    setBusy(true);

    try {
      await downloadServerExport(
        type,
        type === "backup-json" ? undefined : activeUserId
      );
    } catch (error) {
      setImportState({
        status: "error",
        message: (error as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const processFile = useCallback(
    async (file: File) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const guessedFormat: ImportFormat = extension === "csv" ? "trades-csv" : format;
      const text = await file.text();

      try {
        if (guessedFormat === "backup-json") {
          setImportState({
            status: "parsed",
            payload: parseBackup(text),
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
          return;
        }

        setImportState({
          status: "parsed",
          payload: {
            kind: "items",
            format: guessedFormat,
            result,
          },
        });
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
    void processFile(files[0]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleConfirmImport = async () => {
    if (importState.status !== "parsed") return;

    setBusy(true);

    try {
      if (importState.payload.kind === "items") {
        const count = importState.payload.result.data.length;

        if (
          importState.payload.format === "trades-json" ||
          importState.payload.format === "trades-csv"
        ) {
          await importItemsToServer({
            format: importState.payload.format,
            mode,
            profileId: activeUserId,
            items: importState.payload.result.data as Trade[],
          });
          await syncServerSnapshot();
          setImportState({
            status: "done",
            count,
            label: `${activeUser.name}的交易记录`,
          });
        } else {
          await importItemsToServer({
            format: "thoughts-json",
            mode,
            profileId: activeUserId,
            items: importState.payload.result.data as Thought[],
          });
          await syncServerSnapshot();
          setImportState({
            status: "done",
            count,
            label: `${activeUser.name}的思考笔记`,
          });
        }
      } else {
        const { backup } = importState.payload;
        await importBackupToServer({
          mode,
          payload: {
            tradesByUser: backup.tradesByUser,
            thoughtsByUser: backup.thoughtsByUser,
            dcaByUser: backup.dcaByUser,
            settingsByUser: backup.settingsByUser,
          },
        });

        if (backup.activeUserId) {
          setActiveUserId(backup.activeUserId);
        }

        await syncServerSnapshot();

        const count =
          APP_USERS.reduce((sum, user) => sum + backup.tradesByUser[user.id].length, 0) +
          APP_USERS.reduce((sum, user) => sum + backup.thoughtsByUser[user.id].length, 0) +
          APP_USERS.reduce((sum, user) => sum + backup.dcaByUser[user.id].length, 0);

        setImportState({
          status: "done",
          count,
          label: "完整双人数据包",
        });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setImportState({
        status: "error",
        message: (error as Error).message,
      });
    } finally {
      setBusy(false);
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
            <h2 className="text-sm font-semibold text-text-primary">服务器数据管理</h2>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex shrink-0 border-b border-border px-5">
            <TabButton active={tab === "export"} onClick={() => setTab("export")}>
              下载到本地
            </TabButton>
            <TabButton
              active={tab === "import"}
              onClick={() => {
                setTab("import");
                resetImport();
              }}
            >
              上传到服务器
            </TabButton>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {tab === "export" && (
              <div>
                <div className="mb-4 rounded-xl border border-border bg-surface-2/70 px-4 py-3 text-xs leading-5 text-text-muted">
                  下载时会直接从服务器读取最新数据，再保存到你的本地设备。这样两台电脑导出的都是同一份服务器数据。
                </div>

                <ExportRow
                  label="完整双人数据包"
                  sub={`导出两位用户的交易、思考笔记和本金，共 ${totalTrades} 条交易 / ${totalThoughts} 条笔记`}
                  icon={FileArchive}
                  onJSON={() => {
                    void handleExport("backup-json");
                  }}
                  loading={busy}
                />
                <ExportRow
                  label={`${activeUser.name}的交易记录`}
                  sub={`${tradesByUser[activeUserId]?.length ?? 0} 条交易，可导出为 JSON 或 CSV`}
                  icon={FileSpreadsheet}
                  onJSON={() => {
                    void handleExport("trades-json");
                  }}
                  onCSV={() => {
                    void handleExport("trades-csv");
                  }}
                  loading={busy}
                />
                <ExportRow
                  label={`${activeUser.name}的思考笔记`}
                  sub={`${thoughtsByUser[activeUserId]?.length ?? 0} 条笔记，可导出为 JSON`}
                  icon={FileJson}
                  onJSON={() => {
                    void handleExport("thoughts-json");
                  }}
                  loading={busy}
                />
              </div>
            )}

            {tab === "import" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-surface-2/70 px-4 py-3 text-xs leading-5 text-text-muted">
                  文件会先在当前浏览器本地解析，确认后再写入服务器。写入完成后，两台电脑都会在下一次同步时看到同一份更新。
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
                        ? "双人备份会按用户分别合并到服务器，并更新两位用户的本金。"
                        : "双人备份会直接覆盖服务器上两位用户的当前数据。"
                      : mode === "merge"
                        ? `保留${activeUser.name}当前服务器数据，只追加新记录。`
                        : `用文件内容直接覆盖${activeUser.name}当前这类服务器数据。`}
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
                        <p className="font-medium">
                          {importState.payload.result.data.length} 条记录准备上传到服务器
                        </p>
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
                        sum +
                        backup.tradesByUser[user.id].length +
                        backup.thoughtsByUser[user.id].length +
                        backup.dcaByUser[user.id].length,
                      0
                    );

                    return (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2.5 rounded-lg border border-profit/20 bg-profit/10 p-3">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-profit" />
                          <div className="text-xs text-profit">
                            <p className="font-medium">备份包已识别，共 {totalItems} 条数据</p>
                            <p className="mt-0.5 text-text-muted">
                              上传后会同步到服务器上的两位用户数据
                            </p>
                          </div>
                        </div>

                        <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-text-muted">
                          {APP_USERS.map((user) => (
                            <p key={user.id}>
                              {user.name}: {backup.tradesByUser[user.id].length} 条交易，
                              {backup.thoughtsByUser[user.id].length} 条笔记，
                              {backup.dcaByUser[user.id].length} 条定投，
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
                      已成功上传 {importState.count} 条 {importState.label}
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
                onClick={() => {
                  void handleConfirmImport();
                }}
                disabled={
                  busy ||
                  (importState.payload.kind === "items" &&
                    importState.payload.result.data.length === 0)
                }
              >
                {busy
                  ? "上传中..."
                  : importState.payload.kind === "items"
                    ? `上传 ${importState.payload.result.data.length} 条记录`
                    : "上传完整双人数据包"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
