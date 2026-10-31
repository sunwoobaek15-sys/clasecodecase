"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Alert, Badge, Button, Card, Empty, Page, StatusBadge, fmtDate } from "@/components/ui";
import { api, errText } from "@/lib/api";
import type { AutonomyTask } from "@/lib/types";
import { useApi } from "@/lib/useApi";

type Policy = { actions: Record<string, { risk: string; approval: boolean; label: string }>; never_automatic: string[] };

export default function AutonomyPage() {
  const tasks = useApi<AutonomyTask[]>("/autonomy/tasks");
  const policy = useApi<Policy>("/autonomy/policy");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad" | "warn"; text: string } | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  async function call(key: string, path: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(key);
    setMsg(null);
    try {
      const r = await api<{ created?: number[]; auto_run?: number[]; disabled?: boolean; status?: string }>(path, { method: "POST" });
      if (r.disabled) setMsg({ tone: "warn", text: "자율 시스템이 Settings에서 꺼져 있습니다." });
      else if (r.created) setMsg({ tone: "ok", text: `새 제안 ${r.created.length}개${r.auto_run?.length ? `, 안전한 작업 ${r.auto_run.length}개 자동 실행` : ""}` });
      tasks.reload();
    } catch (e) {
      setMsg({ tone: "bad", text: errText(e) });
    } finally {
      setBusy(null);
    }
  }

  const pending = tasks.data?.filter((t) => t.status === "proposed") ?? [];
  const done = tasks.data?.filter((t) => t.status !== "proposed") ?? [];

  return (
    <Page title="Autonomy" subtitle="SELF AI가 데이터를 살펴 스스로 할 일을 제안합니다. 위험한 작업은 반드시 승인을 받습니다."
      actions={<Button variant="primary" loading={busy === "scan"} onClick={() => call("scan", "/autonomy/scan")}><Icon name="refresh" className="h-4 w-4" /> 지금 분석</Button>}>
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {tasks.error && <Alert>{tasks.error}</Alert>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title={`승인 대기 · 제안 ${pending.length}`}>
            {!pending.length ? <Empty>대기 중인 제안이 없습니다. &quot;지금 분석&quot;을 눌러 보세요.</Empty> : (
              <ul className="space-y-2">
                {pending.map((t) => (
                  <li key={t.id} className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="min-w-0 flex-1 text-sm font-medium">{t.title}</span>
                      <Badge tone={t.risk === "high" ? "bad" : "ok"}>{t.risk === "high" ? "위험 · 승인 필요" : "안전"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">{t.reason}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {t.requires_approval
                        ? <Button size="sm" variant="primary" loading={busy === `a${t.id}`} onClick={() => call(`a${t.id}`, `/autonomy/tasks/${t.id}/approve`, `"${t.title}" 작업을 승인하고 실행할까요?\n\n${policy.data?.actions[t.action]?.label ?? ""}`)}><Icon name="check" className="h-3.5 w-3.5" /> 승인 후 실행</Button>
                        : <Button size="sm" variant="primary" loading={busy === `r${t.id}`} onClick={() => call(`r${t.id}`, `/autonomy/tasks/${t.id}/run`)}>실행</Button>}
                      <Button size="sm" variant="ghost" onClick={() => call(`x${t.id}`, `/autonomy/tasks/${t.id}/reject`)}>거절</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="처리된 작업">
            {!done.length ? <Empty>기록이 없습니다.</Empty> : (
              <ul className="divide-y divide-line">
                {done.map((t) => (
                  <li key={t.id} className="py-2.5">
                    <button className="flex w-full flex-wrap items-center gap-1.5 text-left" onClick={() => setOpen(open === t.id ? null : t.id)}>
                      <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span><StatusBadge status={t.status} /><span className="text-[11px] text-muted">{fmtDate(t.updated_at ?? t.created_at)}</span>
                    </button>
                    {open === t.id && t.result && <Result task={t} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title={<span className="flex items-center gap-1.5"><Icon name="shield" className="h-4 w-4" /> 안전 정책</span>}>
          <div className="space-y-3 text-sm">
            <div>
              <div className="mb-1 text-xs text-muted">할 수 있는 작업</div>
              <ul className="space-y-1.5">
                {policy.data && Object.entries(policy.data.actions).map(([k, a]) => (
                  <li key={k} className="flex items-start gap-2 text-xs"><Badge tone={a.approval ? "bad" : "ok"}>{a.approval ? "승인" : "자동 가능"}</Badge><span>{a.label}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted">사용자 승인 없이 절대 하지 않는 일</div>
              <ul className="list-disc space-y-0.5 pl-5 text-xs">{policy.data?.never_automatic.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <p className="text-[11px] text-muted">안전한 작업의 자동 실행은 <Link className="underline" href="/settings">Settings</Link>에서 켤 수 있습니다 (기본: 꺼짐).</p>
          </div>
        </Card>
      </div>
    </Page>
  );
}

function Result({ task }: { task: AutonomyTask }) {
  const r = task.result as Record<string, unknown>;
  if (r.error) return <div className="mt-2"><Alert>{String(r.error)}</Alert></div>;
  return (
    <div className="mt-2 rounded-lg bg-panel-2 p-3 text-xs">
      {task.action === "plan_research" && r.research_task_id ? <p className="mb-2"><Link className="text-accent underline" href="/research">조사 계획 #{String(r.research_task_id)}</Link>이 만들어졌습니다. Research 화면에서 실행하세요.</p> : null}
      {task.action === "suggest_improvement" && r.suggestion ? <p className="mb-2 text-sm">{String(r.suggestion)}</p> : null}
      <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted scroll-thin">{JSON.stringify(r, null, 2)}</pre>
    </div>
  );
}
