"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AIStatus } from "@/lib/types";
import { Icon } from "./icons";

export const NAV = [
  { href: "/", label: "Dashboard", ko: "대시보드", icon: "dashboard" },
  { href: "/chat", label: "AI Chat", ko: "대화", icon: "chat" },
  { href: "/memory", label: "Memory", ko: "기억", icon: "memory" },
  { href: "/learning", label: "Learning", ko: "학습", icon: "learning" },
  { href: "/research", label: "Research", ko: "조사", icon: "research" },
  { href: "/knowledge", label: "Knowledge", ko: "지식", icon: "knowledge" },
  { href: "/evaluation", label: "Evaluation", ko: "평가", icon: "evaluation" },
  { href: "/autonomy", label: "Autonomy", ko: "자율 작업", icon: "autonomy" },
  { href: "/settings", label: "Settings", ko: "설정", icon: "settings" },
];

const MOBILE_TABS = ["/", "/chat", "/memory", "/knowledge"];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

function AIBadge() {
  const [st, setSt] = useState<AIStatus | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<AIStatus>("/ai/status")
        .then((s) => alive && (setSt(s), setErr(false)))
        .catch(() => alive && setErr(true));
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const ok = st?.ready;
  const label = err ? "서버 연결 안 됨" : !st ? "확인 중…" : ok ? `${st.active?.model ?? ""}` : "AI 연결 안 됨";
  return (
    <Link href="/settings" className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-xs text-muted hover:text-text"
      title={st?.error ?? undefined}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${err || (st && !ok) ? "bg-bad" : ok ? "bg-ok" : "bg-warn"}`} />
      <span className="max-w-[9rem] truncate">{st ? `${st.mode} · ` : ""}{label}</span>
    </Link>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = NAV.find((n) => isActive(path, n.href));

  return (
    <div className="flex min-h-dvh">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-panel lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">S</div>
          <div>
            <div className="text-sm font-semibold tracking-wide">SELF AI</div>
            <div className="text-[11px] text-muted">Personal AI Lab</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 scroll-thin">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive(path, n.href) ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel-2 hover:text-text"}`}>
              <Icon name={n.icon} className="h-[18px] w-[18px]" />
              <span>{n.label}</span>
              <span className="ml-auto text-[11px] opacity-60">{n.ko}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-3"><AIBadge /></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur lg:hidden">
          <button aria-label="메뉴 열기" onClick={() => setOpen(true)} className="-ml-1 rounded-md p-1 text-muted hover:text-text">
            <Icon name="menu" />
          </button>
          <div className="text-sm font-semibold">{current?.label ?? "SELF AI"}</div>
          <div className="ml-auto"><AIBadge /></div>
        </header>

        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>

        {/* mobile bottom tabs */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {MOBILE_TABS.map((href) => {
            const n = NAV.find((x) => x.href === href)!;
            return (
              <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive(path, href) ? "text-accent" : "text-muted"}`}>
                <Icon name={n.icon} />
                {n.ko}
              </Link>
            );
          })}
          <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted">
            <Icon name="menu" />
            더보기
          </button>
        </nav>
      </div>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="fade-in absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-panel">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="text-sm font-semibold">SELF AI</div>
              <button aria-label="메뉴 닫기" onClick={() => setOpen(false)} className="text-muted"><Icon name="close" /></button>
            </div>
            <nav className="space-y-0.5 px-3">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${isActive(path, n.href) ? "bg-accent-soft text-accent" : "text-muted"}`}>
                  <Icon name={n.icon} className="h-[18px] w-[18px]" />
                  {n.label}
                  <span className="ml-auto text-xs opacity-60">{n.ko}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
