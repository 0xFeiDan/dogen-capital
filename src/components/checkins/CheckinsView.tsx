"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Flag,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/thoughts/MarkdownRenderer";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";
import { useAppUsers } from "@/store/useAppUsers";
import type { DailyCheckinTask } from "@/types";

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nowIso() {
  return new Date().toISOString();
}

function makeTaskId() {
  return `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function stripMarkdown(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "[图片]")
    .replace(/\[[^\]]+]\([^)]*\)/g, "$1")
    .replace(/[#>*_`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function taskContent(task: DailyCheckinTask) {
  return task.content ?? task.description ?? "";
}

function emptyTask(): DailyCheckinTask {
  const now = nowIso();
  return {
    id: makeTaskId(),
    title: "",
    content: "",
    description: "",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
}

export function CheckinsView() {
  const activeUserId = useAppUsers((state) => state.activeUserId);
  const today = useMemo(() => todayInShanghai(), []);
  const [tasks, setTasks] = useState<DailyCheckinTask[]>([]);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"view" | "edit">("view");
  const [selectedTask, setSelectedTask] = useState<DailyCheckinTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DailyCheckinTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    const active = tasks.filter((task) => task.status !== "ended");
    return {
      total: tasks.length,
      active: active.length,
      checkedToday: active.filter((task) => task.checkedToday).length,
      ended: tasks.filter((task) => task.status === "ended").length,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (!keyword) return true;
      return (
        task.title.toLowerCase().includes(keyword) ||
        taskContent(task).toLowerCase().includes(keyword)
      );
    });
  }, [query, tasks]);

  const activeTasks = filteredTasks.filter((task) => task.status !== "ended");
  const endedTasks = filteredTasks.filter((task) => task.status === "ended");

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "请求失败");
    return payload as T;
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const payload = await fetchJson<{ tasks: DailyCheckinTask[] }>(
          `/api/data/checkins/tasks?profileId=${activeUserId}&date=${today}`
        );
        if (!cancelled) setTasks(payload.tasks);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "加载任务失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeUserId, today]);

  function openTask(task: DailyCheckinTask, mode: "view" | "edit" = "view") {
    setSelectedTask(task);
    setDrawerMode(mode);
    setDrawerOpen(true);
  }

  function createTask() {
    setSelectedTask(emptyTask());
    setDrawerMode("edit");
    setDrawerOpen(true);
  }

  async function saveTask(task: DailyCheckinTask) {
    const title = task.title.trim();
    if (!title) {
      setError("任务标题不能为空");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const nextTask = {
        ...task,
        title,
        content: taskContent(task),
        description: taskContent(task),
        updatedAt: nowIso(),
      };
      const payload = await fetchJson<{ task: DailyCheckinTask }>("/api/data/checkins/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: activeUserId, task: nextTask }),
      });

      setTasks((current) => {
        const exists = current.some((item) => item.id === payload.task.id);
        return exists
          ? current.map((item) => (item.id === payload.task.id ? payload.task : item))
          : [payload.task, ...current];
      });
      setSelectedTask(payload.task);
      setDrawerMode("view");
    } catch (err) {
      setError((err as Error).message || "保存任务失败");
    } finally {
      setSaving(false);
    }
  }

  async function checkToday(task: DailyCheckinTask) {
    if (task.status === "ended") return;

    setCheckingId(task.id);
    setError("");

    try {
      const payload = await fetchJson<{ task: DailyCheckinTask | null }>("/api/data/checkins/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: activeUserId,
          action: "check",
          taskId: task.id,
          date: today,
        }),
      });

      if (payload.task) {
        setTasks((current) =>
          current.map((item) => (item.id === payload.task?.id ? payload.task : item))
        );
        if (selectedTask?.id === payload.task.id) setSelectedTask(payload.task);
      }
    } catch (err) {
      setError((err as Error).message || "今日检查失败");
    } finally {
      setCheckingId(null);
    }
  }

  async function endTask(task: DailyCheckinTask) {
    await saveTask({ ...task, status: "ended", endedAt: nowIso() });
  }

  async function deleteTask(task: DailyCheckinTask) {
    setSaving(true);
    setError("");

    try {
      await fetchJson<{ ok: true }>(
        `/api/data/checkins/tasks?profileId=${activeUserId}&taskId=${task.id}`,
        { method: "DELETE" }
      );
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setDeleteTarget(null);
      if (selectedTask?.id === task.id) {
        setDrawerOpen(false);
        setSelectedTask(null);
      }
    } catch (err) {
      setError((err as Error).message || "删除任务失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-5">
        <section className="rounded-lg border border-border bg-surface-1">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-accent" />
                <h1 className="text-base font-semibold text-text-primary">每日检查</h1>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                今天 {today}，任务像思考笔记一样保存，日常只记录检查状态。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="任务" value={stats.total} />
              <Metric label="进行中" value={stats.active} />
              <Metric label="今日已检" value={`${stats.checkedToday}/${stats.active}`} />
              <Metric label="已结束" value={stats.ended} />
            </div>
          </div>

          {error && (
            <div className="border-b border-loss/20 bg-loss/5 px-5 py-2 text-xs text-loss">
              {error}
            </div>
          )}

          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-64 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-3 text-sm text-text-primary outline-none focus:border-accent"
                  placeholder="搜索任务标题或内容"
                />
              </div>
              <Button
                type="button"
                variant="primary"
                iconLeft={<Plus className="h-4 w-4" />}
                onClick={createTask}
              >
                新增任务
              </Button>
            </div>

            {loading ? (
              <div className="rounded-lg border border-border bg-surface-2 px-4 py-16 text-center text-sm text-text-muted">
                正在加载...
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-16 text-center">
                <p className="text-sm font-medium text-text-primary">还没有任务</p>
                <p className="mt-1 text-xs text-text-muted">新建一个任务后，它会像思考笔记一样长期保留。</p>
              </div>
            ) : (
              <>
                <TaskGrid
                  title="任务列表"
                  tasks={activeTasks}
                  checkingId={checkingId}
                  onOpen={openTask}
                  onCheck={checkToday}
                  onEnd={(task) => void endTask(task)}
                  onDelete={setDeleteTarget}
                />

                {endedTasks.length > 0 && (
                  <TaskGrid
                    title="已结束"
                    tasks={endedTasks}
                    checkingId={checkingId}
                    onOpen={openTask}
                    onCheck={checkToday}
                    onEnd={(task) => void endTask(task)}
                    onDelete={setDeleteTarget}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <TaskDrawer
        open={drawerOpen}
        mode={drawerMode}
        task={selectedTask}
        saving={saving}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedTask(null);
        }}
        onModeChange={setDrawerMode}
        onTaskChange={setSelectedTask}
        onSave={(task) => void saveTask(task)}
        onCheck={(task) => void checkToday(task)}
        onEnd={(task) => void endTask(task)}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="删除这个任务？"
        description={deleteTarget ? `"${deleteTarget.title}" 会被永久删除，历史检查记录也会删除。` : undefined}
        confirmLabel="删除"
        confirmVariant="danger"
        loading={saving}
        onConfirm={() => {
          if (deleteTarget) void deleteTask(deleteTarget);
        }}
      />
    </>
  );
}

function TaskGrid({
  title,
  tasks,
  checkingId,
  onOpen,
  onCheck,
  onEnd,
  onDelete,
}: {
  title: string;
  tasks: DailyCheckinTask[];
  checkingId: string | null;
  onOpen: (task: DailyCheckinTask, mode?: "view" | "edit") => void;
  onCheck: (task: DailyCheckinTask) => void;
  onEnd: (task: DailyCheckinTask) => void;
  onDelete: (task: DailyCheckinTask) => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            checking={checkingId === task.id}
            onOpen={() => onOpen(task, "view")}
            onEdit={() => onOpen(task, "edit")}
            onCheck={() => onCheck(task)}
            onEnd={() => onEnd(task)}
            onDelete={() => onDelete(task)}
          />
        ))}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  checking,
  onOpen,
  onEdit,
  onCheck,
  onEnd,
  onDelete,
}: {
  task: DailyCheckinTask;
  checking: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onCheck: () => void;
  onEnd: () => void;
  onDelete: () => void;
}) {
  const content = taskContent(task);
  const excerpt = stripMarkdown(content).slice(0, 150);
  const ended = task.status === "ended";

  return (
    <div
      className={cn(
        "group flex min-h-48 cursor-pointer flex-col gap-3 rounded-xl border bg-surface-1 p-5 shadow-card shadow-inner-sm transition-colors",
        task.checkedToday ? "border-profit/30" : "border-border hover:bg-surface-2/60",
        ended && "opacity-70"
      )}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
            task.checkedToday
              ? "border-profit/25 bg-profit/10 text-profit"
              : ended
                ? "border-text-muted/25 bg-surface-3 text-text-muted"
                : "border-accent/25 bg-accent/10 text-accent"
          )}
        >
          {task.checkedToday ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : ended ? (
            <XCircle className="h-3 w-3" />
          ) : (
            <Clock3 className="h-3 w-3" />
          )}
          {task.checkedToday ? "今日已检查" : ended ? "已结束" : "待检查"}
        </span>

        <div
          className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-accent"
            aria-label="编辑任务"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-loss"
            aria-label="删除任务"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <h3 className={cn("line-clamp-2 text-sm font-semibold text-text-primary", ended && "line-through")}>
        {task.title}
      </h3>
      <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-text-muted">
        {excerpt || "暂无详细内容，点击打开后补充。"}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="text-2xs text-text-muted">
          检查 {task.checkCount ?? 0} 次
          {task.lastCheckedAt ? ` · 最近 ${task.lastCheckedAt.slice(0, 10)}` : ""}
        </span>
        <div className="flex gap-1.5" onClick={(event) => event.stopPropagation()}>
          {!ended && (
            <Button
              type="button"
              size="xs"
              variant={task.checkedToday ? "secondary" : "profit"}
              loading={checking}
              iconLeft={<CheckCircle2 className="h-3.5 w-3.5" />}
              onClick={onCheck}
            >
              {task.checkedToday ? "已检查" : "今日已检查"}
            </Button>
          )}
          {!ended && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              iconLeft={<Flag className="h-3.5 w-3.5" />}
              onClick={onEnd}
            >
              结束
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskDrawer({
  open,
  mode,
  task,
  saving,
  onClose,
  onModeChange,
  onTaskChange,
  onSave,
  onCheck,
  onEnd,
}: {
  open: boolean;
  mode: "view" | "edit";
  task: DailyCheckinTask | null;
  saving: boolean;
  onClose: () => void;
  onModeChange: (mode: "view" | "edit") => void;
  onTaskChange: (task: DailyCheckinTask) => void;
  onSave: (task: DailyCheckinTask) => void;
  onCheck: (task: DailyCheckinTask) => void;
  onEnd: (task: DailyCheckinTask) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const isNew = task ? !task.title.trim() && !taskContent(task).trim() : false;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !task) return null;

  async function upload(files: FileList | null) {
    if (!files || files.length === 0 || !task) return;

    setUploading(true);
    try {
      const snippets: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/data/checkins/upload", {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !payload.url) throw new Error(payload.error || "图片上传失败");
        snippets.push(`![image|w=640](${payload.url})`);
      }
      const nextContent = `${taskContent(task).trimEnd()}\n\n${snippets.join("\n\n")}\n`;
      onTaskChange({ ...task, content: nextContent, description: nextContent });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "fixed right-0 top-0 z-40 flex h-full w-full flex-col border-l border-border bg-surface-1 transition-transform duration-200 ease-in-out sm:w-[720px]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-text-primary">
              {isNew ? "新建任务" : mode === "view" ? "查看任务" : "编辑任务"}
            </h2>
            {!isNew && (
              <div className="flex rounded-md border border-border bg-surface-2 p-0.5">
                <button
                  type="button"
                  onClick={() => onModeChange("view")}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    mode === "view"
                      ? "bg-surface-4 text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  查看
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange("edit")}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    mode === "edit"
                      ? "bg-surface-4 text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  编辑
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "view" && !isNew ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                    task.checkedToday
                      ? "border-profit/25 bg-profit/10 text-profit"
                      : "border-accent/25 bg-accent/10 text-accent"
                  )}
                >
                  {task.checkedToday ? "今日已检查" : "今日未检查"}
                </span>
                {task.status === "ended" && (
                  <span className="inline-flex items-center rounded-md border border-text-muted/25 bg-surface-3 px-2 py-0.5 text-xs font-medium text-text-muted">
                    已结束
                  </span>
                )}
              </div>
              <h1 className="mb-3 text-xl font-bold leading-snug text-text-primary">
                {task.title}
              </h1>
              <p className="mb-5 text-xs text-text-muted">
                检查 {task.checkCount ?? 0} 次
                {task.lastCheckedAt ? ` · 最近 ${task.lastCheckedAt.slice(0, 10)}` : ""}
              </p>
              {taskContent(task).trim() ? (
                <MarkdownRenderer content={taskContent(task)} />
              ) : (
                <p className="text-sm text-text-muted">暂无详细内容。</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-1 px-5 py-4">
              {task.status !== "ended" && (
                <Button
                  variant={task.checkedToday ? "secondary" : "profit"}
                  iconLeft={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => onCheck(task)}
                >
                  {task.checkedToday ? "今天已检查" : "今日已检查"}
                </Button>
              )}
              {task.status !== "ended" && (
                <Button
                  variant="secondary"
                  iconLeft={<Flag className="h-4 w-4" />}
                  onClick={() => onEnd(task)}
                >
                  结束任务
                </Button>
              )}
              <Button
                variant="secondary"
                iconLeft={<Pencil className="h-4 w-4" />}
                onClick={() => onModeChange("edit")}
              >
                编辑
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
              <label className="space-y-1">
                <span className="block text-xs text-text-muted">任务标题</span>
                <input
                  value={task.title}
                  onChange={(event) => onTaskChange({ ...task, title: event.target.value })}
                  className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text-primary outline-none focus:border-accent"
                  placeholder="例如：检查 BMNR mNAV 数据源"
                />
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-text-muted">
                  详细内容支持 Markdown，图片可写成 ![截图|w=420](url) 调整大小
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  iconLeft={<Upload className="h-4 w-4" />}
                  loading={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  上传图片
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(event) => void upload(event.target.files)}
                />
              </div>
              <textarea
                value={taskContent(task)}
                onChange={(event) =>
                  onTaskChange({
                    ...task,
                    content: event.target.value,
                    description: event.target.value,
                  })
                }
                className="min-h-[300px] w-full resize-y rounded-lg border border-border bg-surface-2 p-4 font-mono text-sm leading-relaxed text-text-primary outline-none focus:border-accent"
                placeholder="写任务背景、检查标准、操作步骤、注意事项..."
              />
              <div className="rounded-lg border border-border bg-surface-2 p-4">
                {taskContent(task).trim() ? (
                  <MarkdownRenderer content={taskContent(task)} />
                ) : (
                  <p className="text-sm text-text-muted">预览会显示在这里。</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-1 px-5 py-4">
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button
                variant="primary"
                loading={saving}
                iconLeft={<Save className="h-4 w-4" />}
                onClick={() => onSave(task)}
              >
                保存任务
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-20 rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-2xs text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}
