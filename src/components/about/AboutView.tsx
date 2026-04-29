"use client";

import { useMemo } from "react";
import { TrendingUp, BookOpen, Brain, Trophy, Keyboard } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useTrades } from "@/store/useTrades";
import { useThoughts } from "@/store/useThoughts";
import { usePortfolioStats } from "@/store/selectors";
import { formatCurrency, getPnlClass } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Skills ───────────────────────────────────────────────────────────────────

const SKILLS = [
  "股票",
  "期权",
  "技术分析",
  "宏观",
  "风险管理",
  "量化",
];

// ─── Stat item ────────────────────────────────────────────────────────────────

function StatItem({ label, value, sub, valueClass }: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="text-center">
      <p className={cn("text-xl font-semibold tabular-nums", valueClass ?? "text-text-primary")}>
        {value}
      </p>
      <p className="text-xs text-text-muted mt-0.5">{label}</p>
      {sub && <p className="text-2xs text-text-muted">{sub}</p>}
    </div>
  );
}

// ─── Keyboard shortcut row ────────────────────────────────────────────────────

function Shortcut({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-text-muted">{desc}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded border border-border bg-surface-3 text-2xs font-mono text-text-secondary">
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AboutView() {
  const trades = useTrades((s) => s.trades);
  const thoughts = useThoughts((s) => s.thoughts);
  const stats = usePortfolioStats();

  const daysActive = useMemo(() => {
    const allDates = [
      ...trades.map((t) => t.createdAt),
      ...thoughts.map((t) => t.createdAt),
    ];
    if (allDates.length === 0) return 0;
    const earliest = new Date(allDates.sort()[0]).getTime();
    return Math.max(1, Math.floor((Date.now() - earliest) / 86400000));
  }, [trades, thoughts]);

  const winRateSign = stats.winRate >= 50 ? "positive" : "negative";

  return (
    <div className="max-w-2xl space-y-5">
      {/* ── Profile ── */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 shrink-0">
            <TrendingUp className="w-7 h-7 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-text-primary">
              Dogen Capital
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              个人投资日志 &amp; 数据分析平台
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {SKILLS.map((s) => (
                <Badge key={s} variant="outline">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Journal Stats ── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-3.5 h-3.5 text-text-muted" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            日志统计
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatItem label="已记录交易" value={String(trades.length)} />
          <StatItem label="已写笔记" value={String(thoughts.length)} />
          <StatItem label="使用天数" value={`${daysActive}天`} />
          <StatItem
            label="胜率"
            value={stats.closedTrades > 0 ? `${stats.winRate.toFixed(1)}%` : "—"}
            valueClass={
              stats.closedTrades > 0
                ? winRateSign === "positive"
                  ? "text-profit"
                  : "text-loss"
                : "text-text-primary"
            }
          />
        </div>

        {stats.closedTrades > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
            <StatItem
              label="总实现盈亏"
              value={formatCurrency(stats.totalNetPnl, "USD", true)}
              valueClass={getPnlClass(stats.totalNetPnl)}
            />
            <StatItem
              label="平均盈利"
              value={formatCurrency(stats.avgWin, "USD", true)}
              valueClass="text-profit"
            />
            <StatItem
              label="平均亏损"
              value={formatCurrency(stats.avgLoss, "USD", true)}
              valueClass="text-loss"
            />
          </div>
        )}
      </Card>

      {/* ── Performance highlight ── */}
      {(stats.bestTrade || stats.worstTrade) && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-3.5 h-3.5 text-text-muted" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              代表性交易
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {stats.bestTrade && (
              <div className="rounded-lg bg-profit/5 border border-profit/20 p-3">
                <p className="text-2xs text-text-muted uppercase tracking-wider mb-1">
                  最佳交易
                </p>
                <p className="font-mono text-sm font-bold text-text-primary">
                  {stats.bestTrade.ticker}
                </p>
                {stats.bestTrade.name && (
                  <p className="text-xs text-text-muted truncate">
                    {stats.bestTrade.name}
                  </p>
                )}
              </div>
            )}
            {stats.worstTrade && (
              <div className="rounded-lg bg-loss/5 border border-loss/20 p-3">
                <p className="text-2xs text-text-muted uppercase tracking-wider mb-1">
                  最差交易
                </p>
                <p className="font-mono text-sm font-bold text-text-primary">
                  {stats.worstTrade.ticker}
                </p>
                {stats.worstTrade.name && (
                  <p className="text-xs text-text-muted truncate">
                    {stats.worstTrade.name}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Philosophy ── */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-3.5 h-3.5 text-text-muted" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            投资哲学
          </h3>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          本日志记录每一笔交易、每一个想法和每一次经验教训，追求持续盈利的交易之路。纪律、流程与持续改进，胜过市场噪音。
        </p>
        <p className="text-sm text-text-secondary leading-relaxed mt-2">
          每个仓位都要记录，每个想法都要写下来。优势来自于复盘。
        </p>
      </Card>

      {/* ── Keyboard shortcuts ── */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Keyboard className="w-3.5 h-3.5 text-text-muted" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            键盘快捷键
          </h3>
        </div>
        <div>
          <Shortcut keys={["Esc"]} desc="关闭任意抽屉或对话框" />
          <Shortcut keys={["Tab"]} desc="在 Markdown 编辑器中插入 2 个空格" />
          <Shortcut keys={["Enter"]} desc="在标签输入框中添加标签" />
          <Shortcut keys={[","]} desc="添加标签（逗号分隔）" />
        </div>
      </Card>

      {/* ── Build info ── */}
      <p className="text-2xs text-text-muted text-center pb-2">
        Dogen Capital · 基于 Next.js 15 构建 · 数据存储于本地浏览器
      </p>
    </div>
  );
}
