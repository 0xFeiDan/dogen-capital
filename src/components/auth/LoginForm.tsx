"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function getSafeRedirect(target: string | null): string {
  if (!target || !target.startsWith("/")) return "/dashboard";
  if (target.startsWith("//")) return "/dashboard";
  return target;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = useMemo(
    () => getSafeRedirect(searchParams.get("next")),
    [searchParams]
  );

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!password.trim()) {
      setError("请输入访问密码");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "登录失败，请稍后重试");
        setSubmitting(false);
        return;
      }

      window.location.href = redirectTo;
    } catch {
      setError("网络异常，请稍后重试");
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface-1/95 shadow-2xl backdrop-blur-md">
      <div className="px-6 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">安全登录</h1>
            <p className="text-sm text-text-muted">
              输入访问密码后才能进入你的交易站点
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
        <Input
          type="password"
          label="访问密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="请输入密码"
          autoComplete="current-password"
          iconLeft={<LockKeyhole className="h-4 w-4" />}
          error={error || undefined}
          disabled={submitting}
        />

        <div className="rounded-xl border border-border bg-surface-2/80 px-4 py-3 text-xs text-text-muted leading-5">
          登录接口已启用服务端密码校验、签名会话 Cookie、失败限流和安全响应头。
          文件导入导出仍然只在本地浏览器完成，不会上传到服务器。
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={submitting}
        >
          进入网站
        </Button>
      </form>
    </div>
  );
}
