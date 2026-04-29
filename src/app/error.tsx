"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application render error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-1 p-6 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-loss/20 bg-loss/10 text-loss">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="text-base font-semibold text-text-primary">页面加载失败</h1>
        <p className="mt-2 text-sm text-text-muted">
          当前页面遇到渲染错误，数据没有被删除。可以重试加载。
        </p>
        <Button
          className="mt-5"
          variant="primary"
          size="sm"
          onClick={reset}
          iconLeft={<RefreshCw className="h-4 w-4" />}
        >
          重试
        </Button>
      </div>
    </div>
  );
}
