"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Alert, Badge, Button, Card, Field, Page, Spinner, Toggle, fmtBytes, fmtDate, inputCls } from "@/components/ui";
import { ApiError, api, download, errText, getToken, setToken } from "@/lib/api";
import type { AIStatus, LogEntry } from "@/lib/types";
import { useApi } from "@/lib/useApi";

type Values = {
  ai_mode: string; local_model: string; cloud_allowed: boolean; cloud_send_memories: boolean; auto_memory: boolean;
  auto_evaluate: boolean; save_chat_history: boolean; memory_context_limit: number; knowledge_context_limit: number;
  search_provider: string; external_network_enabled: boolean; autonomy_enabled: boolean; autonomy_auto_run_safe: boolean; temperature: number;
};
type SettingsResp = { values: Values; env: Record<string, unknown>; options: { ai_modes: string[]; search_providers: string[] } };
type Provider = { provider: string; connected: boolean; detail: string; options: { name: string; label: string; configured: boolean }[] };
type Backup = { name: string; size: number; created_at: string };

const SENSITIVE_TEXT: Record<string, string> = {
  cloud_allowed: "클라우드 AI를 켜면 질문이 외부 서버로 전송되고 유료 요금이 발생할 수 있습니다.",
  cloud_send_memories: "개인 기억과 지식이 클라우드 AI 서버로 전송됩니다.",
  external_network_enabled: "조사 기능이 외부 검색 서비스와 웹 페이지에 접속합니다. 검색어가 외부로 전송됩니다.",
};

export default function SettingsPage() {
  const s = useApi<SettingsResp>("/settings");
  const ai = useApi<AIStatus>("/ai/status");
  const prov = useApi<Provider>("/research/provider");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(changes: Partial<Values>) {
    setSaving(true);
    setMsg(null);
    const sensitiveOn = Object.entries(changes).filter(([k, v]) => v === true && k in SENSITIVE_TEXT);
    try {
      let confirm_sensitive = false;
      if (sensitiveOn.length) {
        if (!confirm(`${sensitiveOn.map(([k]) => SENSITIVE_TEXT[k]).join("\n")}\n\n계속할까요?`)) return;
        confirm_sensitive = true;
      }
      const r = await api<{ values: Values }>("/settings", { method: "PUT", json: { values: changes, confirm_sensitive } });
      s.setData((cur) => (cur ? { ...cur, values: r.values } : cur));
      setMsg({ tone: "ok", text: "저장했습니다." });
      ai.reload();
      prov.reload();
    } catch (e) {
      setMsg({ tone: "bad", text: errText(e) });
    } finally {
      setSaving(false);
    }
  }

  if (s.error && !s.data) return <Page title="Settings"><Alert>{s.error}</Alert><div className="mt-4"><TokenCard /></div></Page>;
  if (!s.data) return <Page title="Settings"><div className="flex items-center gap-2 text-sm text-muted"><Spinner /> 불러오는 중…</div></Page>;
  const v = s.data.values;
  const env = s.data.env;

  return (
    <Page title="Settings" subtitle="비밀 키는 서버의 .env 파일에서만 관리되며 이 화면에 표시되지 않습니다.">
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="AI 모델" actions={<Button size="sm" variant="ghost" onClick={() => ai.reload()}><Icon name="refresh" className="h-3.5 w-3.5" /> 상태 확인</Button>}>
          <div className="space-y-3">
            <Field label="AI 모드">
              <div className="grid grid-cols-3 gap-1.5">
                {s.data.options.ai_modes.map((m) => <Button key={m} variant={v.ai_mode === m ? "primary" : "default"} disabled={saving} onClick={() => save({ ai_mode: m })}>{m}</Button>)}
              </div>
            </Field>
            <p className="text-xs text-muted">AUTO: 로컬 AI를 우선 사용하고, 로컬이 안 될 때만 (허용된 경우) 클라우드 사용 · LOCAL: Ollama만 · CLOUD: 클라우드만</p>
            {ai.data && (ai.data.ready ? <Alert tone="ok">사용 중: {ai.data.active?.provider === "cloud" ? "클라우드" : "로컬"} · {ai.data.active?.model}</Alert> : <Alert tone="bad">{ai.data.error}</Alert>)}
            <Field label="로컬 모델 (Ollama)" hint={<>Ollama 주소: {String(env.OLLAMA_BASE_URL)} · 새 모델은 터미널에서 <code>ollama pull 모델명</code></>}>
              <ModelPicker key={v.local_model} value={v.local_model} models={ai.data?.local.models ?? []} onSave={(m) => save({ local_model: m })} />
            </Field>
            <Field label={`답변 다양성 (temperature) ${v.temperature}`}>
              <input type="range" min={0} max={1.5} step={0.1} defaultValue={v.temperature} onMouseUp={(e) => save({ temperature: +(e.target as HTMLInputElement).value })} onTouchEnd={(e) => save({ temperature: +(e.target as HTMLInputElement).value })} className="w-full accent-[var(--accent)]" />
            </Field>
          </div>
        </Card>

        <Card title="클라우드 AI">
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1.5 pb-2 text-xs">
              <Badge tone={env.CLOUD_ENABLED ? "warn" : "muted"}>CLOUD_ENABLED={String(env.CLOUD_ENABLED)}</Badge>
              <Badge tone={env.CLOUD_API_KEY_SET ? "ok" : "muted"}>API 키 {env.CLOUD_API_KEY_SET ? "설정됨" : "없음"}</Badge>
              {env.CLOUD_MODEL ? <Badge>{String(env.CLOUD_MODEL)}</Badge> : null}
            </div>
            <Toggle checked={v.cloud_allowed} onChange={(x) => save({ cloud_allowed: x })} label="클라우드 AI 사용 허용" hint="서버 .env에서 CLOUD_ENABLED=true와 키가 있어야 실제로 동작합니다. 유료일 수 있습니다." />
            <Toggle checked={v.cloud_send_memories} onChange={(x) => save({ cloud_send_memories: x })} label="개인 기억·지식을 클라우드로 전송" hint="꺼져 있으면 클라우드 사용 시 기억·지식 없이 질문만 보냅니다." />
            {ai.data && <p className="pt-1 text-xs text-muted">상태: {ai.data.cloud.detail}</p>}
          </div>
        </Card>

        <Card title="기억·대화·평가">
          <Toggle checked={v.auto_memory} onChange={(x) => save({ auto_memory: x })} label="대화에서 기억 자동 저장" hint="이름·선호·결정 등을 기억합니다." />
          <Toggle checked={v.save_chat_history} onChange={(x) => save({ save_chat_history: x })} label="대화 기록 저장" hint="끄면 대화가 데이터베이스에 남지 않습니다 (평가도 생략)." />
          <Toggle checked={v.auto_evaluate} onChange={(x) => save({ auto_evaluate: x })} label="답변 자기 평가" hint="답변마다 AI를 한 번 더 호출합니다 (느린 PC에서는 끄세요)." />
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="참고할 기억 수"><input type="number" min={0} max={20} className={inputCls} defaultValue={v.memory_context_limit} onBlur={(e) => save({ memory_context_limit: Math.max(0, Math.min(20, +e.target.value | 0)) })} /></Field>
            <Field label="참고할 지식 수"><input type="number" min={0} max={20} className={inputCls} defaultValue={v.knowledge_context_limit} onBlur={(e) => save({ knowledge_context_limit: Math.max(0, Math.min(20, +e.target.value | 0)) })} /></Field>
          </div>
        </Card>

        <Card title={<span id="research">조사 (웹 검색)</span>}>
          <Toggle checked={v.external_network_enabled} onChange={(x) => save({ external_network_enabled: x })} label="외부 네트워크 접근 허용" hint="조사 기능의 웹 검색·페이지 가져오기에만 사용됩니다. 내부 네트워크 주소는 항상 차단됩니다." />
          <Field label="검색 제공자">
            <select className={inputCls} value={v.search_provider} onChange={(e) => save({ search_provider: e.target.value })}>
              {prov.data?.options.map((o) => <option key={o.name} value={o.name}>{o.label}{o.name !== "none" && !o.configured ? " — 설정 필요" : ""}</option>)}
            </select>
          </Field>
          {prov.data && <div className="mt-2">{prov.data.connected ? <Alert tone="ok">연결됨</Alert> : <Alert tone="bad">연결 필요: {prov.data.detail}</Alert>}</div>}
          <p className="mt-2 text-xs text-muted">무료: Wikipedia (키 불필요), SearXNG (직접 설치 후 .env에 SEARXNG_URL). 키 필요: Brave, Tavily (.env).</p>
        </Card>

        <Card title="자율 시스템">
          <Toggle checked={v.autonomy_enabled} onChange={(x) => save({ autonomy_enabled: x })} label="작업 제안 사용" hint="지식 부족·평가 누락·중복 기억 등을 찾아 제안합니다." />
          <Toggle checked={v.autonomy_auto_run_safe} onChange={(x) => save({ autonomy_auto_run_safe: x })} label="안전한 작업 자동 실행" hint="평가·조사 계획·재검토처럼 데이터를 지우지 않고 외부로 보내지 않는 작업만 자동 실행합니다." />
        </Card>

        <Card title="화면·접근">
          <ThemeToggle />
          <TokenCard inline />
        </Card>
      </div>

      <BackupCard />
      <DataCard />
      <LogsCard />
    </Page>
  );
}

function ModelPicker({ value, models, onSave }: { value: string; models: string[]; onSave: (m: string) => void }) {
  const [custom, setCustom] = useState(value);
  return (
    <div className="flex gap-2">
      {models.length > 0 && (
        <select className={inputCls} value={models.includes(value) ? value : ""} onChange={(e) => e.target.value && onSave(e.target.value)}>
          {!models.includes(value) && <option value="">설치된 모델 선택</option>}
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      )}
      <input className={inputCls} value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="모델 이름" />
      <Button onClick={() => custom.trim() && onSave(custom.trim())} disabled={custom === value}>적용</Button>
    </div>
  );
}

function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLight(document.documentElement.dataset.theme === "light"), 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <Toggle checked={!light} label="다크 모드" onChange={(dark) => {
      setLight(!dark);
      if (dark) delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = "light";
      try { localStorage.setItem("selfai.theme", dark ? "dark" : "light"); } catch { /* ignore */ }
    }} />
  );
}

function TokenCard({ inline }: { inline?: boolean }) {
  const [t, setT] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setT(getToken()), 0);
    return () => clearTimeout(id);
  }, []);
  const body = (
    <Field label="접근 토큰" hint="서버 .env에 ACCESS_TOKEN을 설정했다면 같은 값을 입력하세요. 이 기기 브라우저에만 저장됩니다.">
      <div className="flex gap-2">
        <input type="password" className={inputCls} value={t} onChange={(e) => { setT(e.target.value); setSaved(false); }} autoComplete="off" />
        <Button onClick={() => { setToken(t.trim()); setSaved(true); }}>{saved ? "저장됨" : "저장"}</Button>
      </div>
    </Field>
  );
  return inline ? <div className="mt-2">{body}</div> : <Card title="접근">{body}</Card>;
}

function BackupCard() {
  const list = useApi<Backup[]>("/backups");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ tone: "ok", text: await fn() });
      list.reload();
    } catch (e) {
      setMsg({ tone: "bad", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="백업 및 복구" className="mt-4" actions={
      <>
        <Button size="sm" onClick={() => download("/export", "self-ai-export.json").catch((e) => setMsg({ tone: "bad", text: errText(e) }))}><Icon name="download" className="h-3.5 w-3.5" /> JSON 내보내기</Button>
        <Button size="sm" variant="primary" loading={busy} onClick={() => run(async () => `백업 생성: ${(await api<Backup>("/backups", { method: "POST" })).name}`)}>지금 백업</Button>
      </>}>
      {msg && <div className="mb-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {list.error && <Alert>{list.error}</Alert>}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>다른 기기의 백업 파일 올리기:</span>
        <input ref={fileRef} type="file" accept=".db" className="text-xs file:mr-2 file:rounded file:border file:border-line file:bg-panel-2 file:px-2 file:py-1 file:text-text"
          onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); run(async () => `업로드됨: ${(await api<Backup>("/backups/upload", { method: "POST", body: fd })).name} — 목록에서 복구하세요`); if (fileRef.current) fileRef.current.value = ""; }} />
      </div>
      {!list.data?.length ? <p className="text-sm text-muted">백업이 없습니다.</p> : (
        <ul className="divide-y divide-line text-sm">
          {list.data.map((b) => (
            <li key={b.name} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{b.name}</span>
              <span className="text-xs text-muted">{fmtBytes(b.size)} · {fmtDate(b.created_at)}</span>
              <Button size="sm" variant="ghost" onClick={() => download(`/backups/${encodeURIComponent(b.name)}/download`, b.name)}>받기</Button>
              <Button size="sm" onClick={() => {
                const c = prompt(`현재 데이터를 "${b.name}" 시점으로 되돌립니다. (현재 상태는 자동 백업됩니다)\n계속하려면 RESTORE 를 입력하세요.`);
                if (c === "RESTORE") run(async () => { const r = await api<{ safety_backup: string }>(`/backups/${encodeURIComponent(b.name)}/restore`, { method: "POST", json: { confirm: c } }); return `복구 완료. 복구 전 상태는 ${r.safety_backup}에 저장했습니다.`; });
              }}>복구</Button>
              <Button size="sm" variant="danger" onClick={() => confirm("이 백업 파일을 삭제할까요?") && run(async () => { await api(`/backups/${encodeURIComponent(b.name)}`, { method: "DELETE" }); return "백업 삭제됨"; })}>삭제</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const SCOPES: [string, string][] = [["conversations", "대화"], ["memories", "기억"], ["knowledge", "지식"], ["learning", "학습 기록"], ["research", "조사"], ["evaluations", "평가·피드백"], ["autonomy", "자율 작업"], ["logs", "활동 기록"]];

function DataCard() {
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  async function wipe(scope: string, label: string) {
    const c = prompt(`"${label}" 데이터를 모두 삭제합니다. 삭제 전에 자동으로 백업합니다.\n계속하려면 DELETE 를 입력하세요.`);
    if (c !== "DELETE") return;
    try {
      const r = await api<{ deleted: Record<string, number>; safety_backup: string | null }>("/data/delete", { method: "POST", json: { scope, confirm: c } });
      setMsg({ tone: "ok", text: `삭제됨: ${Object.entries(r.deleted).map(([k, n]) => `${k} ${n}개`).join(", ")}. 백업: ${r.safety_backup ?? "없음"}` });
    } catch (e) {
      setMsg({ tone: "bad", text: e instanceof ApiError ? e.message : errText(e) });
    }
  }
  return (
    <Card title="데이터 관리 · 개인정보" className="mt-4">
      <p className="mb-3 text-sm text-muted">모든 데이터는 이 컴퓨터의 SQLite 파일에 저장됩니다. 클라우드 AI와 외부 네트워크는 기본적으로 꺼져 있습니다. 대량 삭제는 확인 문구 입력과 자동 백업 후에만 실행됩니다.</p>
      {msg && <div className="mb-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <div className="flex flex-wrap gap-2">{SCOPES.map(([k, l]) => <Button key={k} size="sm" variant="danger" onClick={() => wipe(k, l)}>{l} 전체 삭제</Button>)}</div>
    </Card>
  );
}

function LogsCard() {
  const { data } = useApi<LogEntry[]>("/logs?limit=40");
  return (
    <Card title="시스템 로그" className="mt-4">
      {!data?.length ? <p className="text-sm text-muted">로그가 없습니다.</p> : (
        <ul className="max-h-72 space-y-1 overflow-y-auto font-mono text-[11px] scroll-thin">
          {data.map((l) => <li key={l.id} className={l.level === "error" ? "text-bad" : l.level === "warn" ? "text-warn" : "text-muted"}>{fmtDate(l.created_at)} [{l.category}] {l.message}</li>)}
        </ul>
      )}
    </Card>
  );
}
