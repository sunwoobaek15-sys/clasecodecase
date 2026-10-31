"use client";

import { useEffect } from "react";
import { Icon } from "./icons";

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="fade-in mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:py-8">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center gap-2">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions && <div className="ml-auto flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "default"; size?: "sm" | "md"; loading?: boolean };

export function Button({ variant = "default", size = "md", loading, className = "", children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: "bg-accent text-white hover:brightness-110 border-transparent",
    default: "bg-panel-2 text-text hover:border-muted/50 border-line",
    ghost: "bg-transparent text-muted hover:text-text border-transparent",
    danger: "bg-transparent text-bad border-bad/40 hover:bg-bad/10",
  }[variant];
  const s = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  return (
    <button {...rest} disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${s} ${className}`}>
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-label="로딩 중" />;
}

const tones: Record<string, string> = {
  ok: "bg-ok/12 text-ok border-ok/30",
  warn: "bg-warn/12 text-warn border-warn/30",
  bad: "bg-bad/12 text-bad border-bad/30",
  accent: "bg-accent-soft text-accent border-accent/30",
  muted: "bg-panel-2 text-muted border-line",
};

export function Badge({ tone = "muted", children, title }: { tone?: keyof typeof tones | string; children: React.ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${tones[tone] ?? tones.muted}`}>{children}</span>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-panel p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : ""}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</div>;
}

export function Alert({ tone = "bad", children }: { tone?: "bad" | "warn" | "ok" | "accent"; children: React.ReactNode }) {
  const t = { bad: "border-bad/40 bg-bad/8 text-bad", warn: "border-warn/40 bg-warn/8 text-warn", ok: "border-ok/40 bg-ok/8 text-ok", accent: "border-accent/40 bg-accent-soft text-accent" }[tone];
  return <div role={tone === "bad" ? "alert" : "status"} className={`rounded-lg border px-3.5 py-2.5 text-sm ${t}`}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-text outline-none placeholder:text-muted/70 focus:border-accent";

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? "bg-accent" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className={`fade-in relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-panel p-5 scroll-thin sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="닫기" className="ml-auto text-muted hover:text-text"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ScoreBar({ label, value, max = 5 }: { label: string; value: number | null; max?: number }) {
  const pct = value == null ? 0 : (value / max) * 100;
  const tone = value == null ? "bg-line" : value >= 4 ? "bg-ok" : value >= 3 ? "bg-warn" : "bg-bad";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 shrink-0 text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2"><div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} /></div>
      <span className="w-7 text-right tabular-nums">{value == null ? "–" : value.toFixed(1)}</span>
    </div>
  );
}

export function fmtDate(iso?: string | null) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "–";
  return d.toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function fmtBytes(n?: number | null) {
  if (n == null) return "–";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const VERIFICATION: Record<string, { label: string; tone: string }> = {
  unverified: { label: "미검증", tone: "muted" },
  user_verified: { label: "사용자 확인", tone: "ok" },
  multi_source: { label: "다중 출처", tone: "accent" },
  disputed: { label: "충돌 있음", tone: "bad" },
};

export const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "대기", tone: "muted" },
  running: { label: "진행 중", tone: "accent" },
  planning: { label: "계획 중", tone: "accent" },
  searching: { label: "검색 중", tone: "accent" },
  analyzing: { label: "분석 중", tone: "accent" },
  writing: { label: "작성 중", tone: "accent" },
  completed: { label: "완료", tone: "ok" },
  failed: { label: "실패", tone: "bad" },
  needs_connection: { label: "연결 필요", tone: "warn" },
  proposed: { label: "제안됨", tone: "warn" },
  approved: { label: "승인됨", tone: "accent" },
  rejected: { label: "거절됨", tone: "muted" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "muted" };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Confidence({ value }: { value: number }) {
  const tone = value >= 0.75 ? "ok" : value >= 0.5 ? "warn" : "bad";
  return <Badge tone={tone} title="휴리스틱 신뢰도 (0~1)">신뢰도 {value.toFixed(2)}</Badge>;
}
