"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Alert, Badge, Button, Card, Empty, Field, Modal, Page, Spinner, fmtDate, inputCls } from "@/components/ui";
import { api, errText } from "@/lib/api";
import type { Memory } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const KINDS: [string, string][] = [
  ["user_info", "사용자 정보"], ["preference", "사용자 선호"], ["project", "프로젝트 정보"],
  ["conversation", "대화 기록"], ["knowledge", "학습한 지식"], ["decision", "중요한 결정"],
];
const kindLabel = (k: string) => KINDS.find((x) => x[0] === k)?.[1] ?? k;

export default function MemoryPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (kind) params.set("kind", kind);
  const { data, error, loading, reload } = useApi<Memory[]>(`/memories?${params}`);
  const dups = useApi<Memory[][]>("/memories/duplicates");
  const [edit, setEdit] = useState<Partial<Memory> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function remove(m: Memory) {
    if (!confirm(`이 기억을 삭제할까요?\n\n"${m.content}"`)) return;
    try {
      await api(`/memories/${m.id}`, { method: "DELETE" });
      reload();
      dups.reload();
    } catch (e) {
      setErr(errText(e));
    }
  }

  async function dedupe() {
    const n = dups.data?.reduce((a, g) => a + g.length - 1, 0) ?? 0;
    if (!confirm(`중복 기억 ${dups.data?.length}묶음을 병합합니다. ${n}개 행이 삭제됩니다. 계속할까요?`)) return;
    try {
      const r = await api<{ groups: number; removed: number }>("/memories/dedupe", { method: "POST" });
      setMsg(`${r.groups}묶음 병합, ${r.removed}개 삭제했습니다.`);
      reload();
      dups.reload();
    } catch (e) {
      setErr(errText(e));
    }
  }

  return (
    <Page title="Memory" subtitle="SELF AI가 기억하는 내용입니다. 답변 전에 이 목록에서 관련 기억을 검색합니다."
      actions={<Button variant="primary" onClick={() => setEdit({ kind: "user_info", content: "", importance: 3 })}><Icon name="plus" className="h-4 w-4" /> 기억 추가</Button>}>
      <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
        <input className={`${inputCls} min-w-0 flex-1`} placeholder="기억 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit">검색</Button>
        {query && <Button type="button" variant="ghost" onClick={() => { setQ(""); setQuery(""); }}>초기화</Button>}
      </form>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Button size="sm" variant={kind === "" ? "primary" : "default"} onClick={() => setKind("")}>전체</Button>
        {KINDS.map(([k, l]) => <Button key={k} size="sm" variant={kind === k ? "primary" : "default"} onClick={() => setKind(k)}>{l}</Button>)}
      </div>
      {msg && <div className="mb-3"><Alert tone="ok">{msg}</Alert></div>}
      {(err || error) && <div className="mb-3"><Alert>{err || error}</Alert></div>}
      {!!dups.data?.length && (
        <div className="mb-4"><Alert tone="warn">거의 같은 기억이 {dups.data.length}묶음 있습니다. <button className="underline" onClick={dedupe}>병합하기</button></Alert></div>
      )}

      {loading && !data ? <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> 불러오는 중…</div>
        : !data?.length ? <Empty>{query ? "검색 결과가 없습니다." : "저장된 기억이 없습니다. 대화에서 자동으로 저장되거나 직접 추가할 수 있습니다."}</Empty> : (
          <div className="grid gap-2">
            {data.map((m) => (
              <Card key={m.id} className="!p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="accent">{kindLabel(m.kind)}</Badge>
                      <Badge title="중요도">{"★".repeat(m.importance)}</Badge>
                      {m.times_seen > 1 && <Badge title="같은 내용이 반복 언급된 횟수">×{m.times_seen}</Badge>}
                      {m.score != null && <Badge>관련도 {m.score.toFixed(2)}</Badge>}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                    <div className="mt-1.5 text-[11px] text-muted">출처 {m.source} · 생성 {fmtDate(m.created_at)} · 수정 {fmtDate(m.updated_at)}{m.last_used_at ? ` · 최근 사용 ${fmtDate(m.last_used_at)}` : ""}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button aria-label="수정" onClick={() => setEdit(m)} className="rounded p-1.5 text-muted hover:text-text"><Icon name="edit" className="h-4 w-4" /></button>
                    <button aria-label="삭제" onClick={() => remove(m)} className="rounded p-1.5 text-muted hover:text-bad"><Icon name="trash" className="h-4 w-4" /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      {edit && <EditModal m={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); dups.reload(); }} />}
    </Page>
  );
}

function EditModal({ m, onClose, onSaved }: { m: Partial<Memory>; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState(m.kind ?? "user_info");
  const [content, setContent] = useState(m.content ?? "");
  const [importance, setImportance] = useState(m.importance ?? 3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      if (m.id) await api(`/memories/${m.id}`, { method: "PATCH", json: { kind, content, importance } });
      else {
        const r = await api<{ created: boolean }>("/memories", { method: "POST", json: { kind, content, importance } });
        if (!r.created) alert("같은 내용의 기억이 이미 있어 기존 기억을 강화했습니다.");
      }
      onSaved();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={m.id ? "기억 수정" : "기억 추가"}>
      <div className="space-y-3">
        <Field label="종류"><select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="내용"><textarea className={`${inputCls} h-28`} value={content} onChange={(e) => setContent(e.target.value)} maxLength={5000} /></Field>
        <Field label={`중요도 ${importance}`}><input type="range" min={1} max={5} value={importance} onChange={(e) => setImportance(+e.target.value)} className="w-full accent-[var(--accent)]" /></Field>
        {err && <Alert>{err}</Alert>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="primary" loading={busy} disabled={!content.trim()} onClick={save}>저장</Button></div>
      </div>
    </Modal>
  );
}
