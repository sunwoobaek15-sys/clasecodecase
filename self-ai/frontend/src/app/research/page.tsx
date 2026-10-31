"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Markdown } from "@/components/Markdown";
import { Alert, Badge, Button, Card, Confidence, Empty, Page, StatusBadge, Toggle, fmtDate, inputCls } from "@/components/ui";
import { api, errText } from "@/lib/api";
import type { ResearchTask } from "@/lib/types";
import { useApi } from "@/lib/useApi";

type Provider = { provider: string; label: string; connected: boolean; detail: string };
const RUNNING = ["pending", "planning", "searching", "analyzing", "writing"];

export default function ResearchPage() {
  const prov = useApi<Provider>("/research/provider");
  const tasks = useApi<ResearchTask[]>("/research", 3000);
  const [topic, setTopic] = useState("");
  const [useWeb, setUseWeb] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const t = await api<ResearchTask>("/research", { method: "POST", json: { topic, use_web: useWeb } });
      setTopic("");
      setSel(t.id);
      tasks.reload();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Research" subtitle="주제를 조사해 출처를 모으고, 주장을 비교하고, 출처를 단 보고서를 씁니다.">
      {prov.data && (
        prov.data.connected
          ? <Alert tone="ok">웹 검색 연결됨: {prov.data.label}</Alert>
          : <Alert tone="warn"><b>웹 검색 연결 필요</b> — {prov.data.detail} <Link className="underline" href="/settings#research">설정</Link><br />연결 전에는 &quot;내부 지식만으로 조사&quot;를 선택해 저장된 지식에서만 조사할 수 있습니다.</Alert>
      )}
      <Card className="mt-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={`${inputCls} flex-1`} placeholder="조사할 주제 (예: 로컬 LLM의 장단점)" value={topic} maxLength={500}
            onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && topic.trim().length >= 2 && start()} />
          <Button variant="primary" loading={busy} disabled={topic.trim().length < 2} onClick={start}><Icon name="research" className="h-4 w-4" /> 조사 시작</Button>
        </div>
        <Toggle checked={!useWeb} onChange={(v) => setUseWeb(!v)} label="내부 지식만으로 조사" hint="웹 검색 없이 저장된 지식만 출처로 사용합니다." />
        {err && <Alert>{err}</Alert>}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="조사 목록" className="lg:col-span-1">
          {!tasks.data?.length ? <Empty>조사 기록이 없습니다.</Empty> : (
            <ul className="space-y-1">
              {tasks.data.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setSel(t.id)} className={`w-full rounded-lg px-3 py-2 text-left ${sel === t.id ? "bg-accent-soft" : "hover:bg-panel-2"}`}>
                    <div className="flex items-center gap-1.5"><span className="min-w-0 flex-1 truncate text-sm">{t.topic}</span><StatusBadge status={t.status} /></div>
                    <div className="mt-0.5 text-[11px] text-muted">출처 {t.source_count} · {t.origin === "autonomy" ? "자율 제안 · " : ""}{fmtDate(t.created_at)}</div>
                    {RUNNING.includes(t.status) && t.status !== "pending" && <div className="mt-1.5 h-1 overflow-hidden rounded bg-panel-2"><div className="h-full bg-accent transition-all" style={{ width: `${t.progress}%` }} /></div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="min-w-0 lg:col-span-2">{sel ? <TaskView id={sel} onChanged={tasks.reload} onDeleted={() => { setSel(null); tasks.reload(); }} /> : <Empty>왼쪽에서 조사를 선택하거나 새 조사를 시작하세요.</Empty>}</div>
      </div>
    </Page>
  );
}

function TaskView({ id, onChanged, onDeleted }: { id: number; onChanged: () => void; onDeleted: () => void }) {
  const { data: t, error, reload } = useApi<ResearchTask>(`/research/${id}`, 2500);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  if (error) return <Alert>{error}</Alert>;
  if (!t) return null;
  const running = RUNNING.includes(t.status) && !(t.status === "pending" && t.origin === "autonomy");

  async function act(path: string, method = "POST") {
    setMsg(null);
    try {
      const r = await api<{ knowledge_id?: number; verification?: string }>(path, { method });
      if (r?.knowledge_id) setMsg({ tone: "ok", text: `지식으로 저장했습니다 (검증 상태: ${r.verification}).` });
      reload();
      onChanged();
    } catch (e) {
      setMsg({ tone: "bad", text: errText(e) });
    }
  }

  return (
    <div className="space-y-4">
      <Card title={<span className="flex flex-wrap items-center gap-2">{t.topic} <StatusBadge status={t.status} /></span>}
        actions={<button aria-label="삭제" className="text-muted hover:text-bad" onClick={() => confirm("이 조사를 삭제할까요?") && act(`/research/${t.id}`, "DELETE").then(onDeleted)}><Icon name="trash" className="h-4 w-4" /></button>}>
        <div className="space-y-2 text-sm">
          {t.stage_message && <div className="text-muted">{t.stage_message}</div>}
          {running && <div className="h-1.5 overflow-hidden rounded bg-panel-2"><div className="h-full bg-accent transition-all" style={{ width: `${t.progress}%` }} /></div>}
          {t.error && <Alert>{t.error}</Alert>}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {t.search_provider && <Badge>검색: {t.search_provider}</Badge>}
            {t.plan_method && <Badge tone={t.plan_method === "llm" ? "accent" : "muted"}>계획: {t.plan_method === "llm" ? "AI 작성" : "기본 템플릿"}</Badge>}
            {t.report_method && <Badge tone={t.report_method.startsWith("llm") ? "accent" : "muted"}>보고서: {t.report_method.startsWith("llm") ? "AI 작성" : t.report_method === "extractive" ? "발췌 요약" : "없음"}</Badge>}
            {t.saved_to_knowledge && <Badge tone="ok">지식으로 저장됨</Badge>}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {["needs_connection", "failed", "completed"].includes(t.status) || (t.status === "pending" && t.origin === "autonomy") ? (
              <>
                <Button size="sm" onClick={() => act(`/research/${t.id}/run?use_web=true`)}><Icon name="refresh" className="h-3.5 w-3.5" /> 웹으로 {t.status === "pending" ? "실행" : "다시 실행"}</Button>
                <Button size="sm" onClick={() => act(`/research/${t.id}/run?use_web=false`)}>내부 지식만으로 실행</Button>
              </>
            ) : null}
            {t.status === "completed" && !t.saved_to_knowledge && !!t.sources?.length && <Button size="sm" variant="primary" onClick={() => act(`/research/${t.id}/save`)}>조사 결과를 지식으로 저장</Button>}
          </div>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        </div>
      </Card>

      {t.plan?.[0] && (
        <Card title="조사 계획">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div><div className="mb-1 text-xs text-muted">질문</div><ul className="list-disc space-y-0.5 pl-5">{t.plan[0].questions.map((q, i) => <li key={i}>{q}</li>)}</ul></div>
            <div><div className="mb-1 text-xs text-muted">검색어</div><div className="flex flex-wrap gap-1">{t.plan[0].queries.map((q, i) => <Badge key={i}>{q}</Badge>)}</div></div>
          </div>
        </Card>
      )}

      {!!t.sources?.length && (
        <Card title={`출처 ${t.sources.length}개`}>
          <p className="mb-2 text-[11px] text-muted">신뢰도는 도메인 종류·본문 확보·다른 출처와의 일치로 계산한 휴리스틱 점수이며, 사실 여부를 보장하지 않습니다.</p>
          <ol className="space-y-2">
            {t.sources.map((s, i) => (
              <li key={s.id} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">S{i + 1}</Badge>
                  {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate underline underline-offset-2">{s.title}</a> : <span className="min-w-0 flex-1 truncate">{s.title}</span>}
                  <Confidence value={s.reliability} />
                </div>
                {s.url && <div className="mt-0.5 truncate text-[11px] text-muted">{s.url}</div>}
                {s.snippet && <p className="mt-1.5 line-clamp-3 text-xs text-muted">{s.snippet}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1">{s.reliability_notes.map((n, j) => <span key={j} className="text-[11px] text-muted">{n}{j < s.reliability_notes.length - 1 ? " ·" : ""}</span>)}</div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {!!t.comparison?.length && (
        <Card title="출처 비교">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            {t.comparison.map((c) => (
              <div key={c.type}>
                <div className="mb-1 text-xs text-muted">{{ agreements: "일치하는 내용", disagreements: "서로 다른 주장", gaps: "확인되지 않은 부분" }[c.type] ?? c.type}</div>
                {c.items.length ? <ul className="list-disc space-y-1 pl-5">{c.items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <div className="text-xs text-muted">없음</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {t.report && <Card title="보고서"><Markdown text={t.report} /></Card>}
    </div>
  );
}
