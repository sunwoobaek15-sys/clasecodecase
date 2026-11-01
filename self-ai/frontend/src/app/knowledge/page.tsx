"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Markdown } from "@/components/Markdown";
import { Alert, Badge, Button, Confidence, Empty, Field, Modal, Page, Spinner, VERIFICATION, fmtDate, inputCls } from "@/components/ui";
import { api, errText } from "@/lib/api";
import type { Knowledge } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const SRC: Record<string, string> = { text: "직접 입력", file: "파일", research: "조사", chat: "대화", correction: "사용자 수정", starter: "기본 자료" };

export default function KnowledgePage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [verification, setVerification] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  if (verification) params.set("verification", verification);
  const list = useApi<Knowledge[]>(`/knowledge?${params}`);
  const cats = useApi<{ category: string; count: number }[]>("/knowledge/categories");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id || !/^\d+$/.test(id)) return;
    const t = setTimeout(() => setOpen(+id), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <Page title="Knowledge" subtitle="학습·조사·사용자 수정으로 쌓인 지식입니다. 신뢰도는 출처 종류로 계산한 휴리스틱 값입니다.">
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
        <input className={`${inputCls} min-w-0 flex-1`} placeholder="지식 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit">검색</Button>
        {query && <Button type="button" variant="ghost" onClick={() => { setQ(""); setQuery(""); }}>초기화</Button>}
      </form>
      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="카테고리" className={`${inputCls} !w-auto`} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">모든 카테고리</option>
          {cats.data?.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.count})</option>)}
        </select>
        <select aria-label="검증 상태" className={`${inputCls} !w-auto`} value={verification} onChange={(e) => setVerification(e.target.value)}>
          <option value="">모든 검증 상태</option>
          {Object.entries(VERIFICATION).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      {list.error && <Alert>{list.error}</Alert>}
      {list.loading && !list.data ? <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> 불러오는 중…</div>
        : !list.data?.length ? <Empty>{query ? "검색 결과가 없습니다." : <>저장된 지식이 없습니다. <Link className="text-accent" href="/learning">자료를 학습</Link>시키거나 조사 결과를 저장하세요.</>}</Empty> : (
          <div className="grid gap-2 md:grid-cols-2">
            {list.data.map((k) => (
              <button key={k.id} onClick={() => setOpen(k.id)} className="min-w-0 rounded-xl border border-line bg-panel p-4 text-left transition hover:border-accent/50">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">{k.category}</Badge>
                  <Badge tone={VERIFICATION[k.verification]?.tone}>{VERIFICATION[k.verification]?.label ?? k.verification}</Badge>
                  <Confidence value={k.confidence} />
                  {k.score != null && <Badge>관련도 {k.score.toFixed(2)}</Badge>}
                </div>
                <div className="truncate text-sm font-medium">{k.title}</div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{k.content}</p>
                <div className="mt-2 text-[11px] text-muted">{SRC[k.source_type] ?? k.source_type} · {k.source ? `${k.source.slice(0, 40)} · ` : ""}사용 {k.times_used}회 · {fmtDate(k.updated_at)}</div>
              </button>
            ))}
          </div>
        )}
      {open != null && <Detail id={open} onClose={() => setOpen(null)} onChanged={() => { list.reload(); cats.reload(); }} onOpen={setOpen} />}
    </Page>
  );
}

function Detail({ id, onClose, onChanged, onOpen }: { id: number; onClose: () => void; onChanged: () => void; onOpen: (id: number) => void }) {
  const { data: k, error, reload } = useApi<Knowledge>(`/knowledge/${id}`);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setErr(null);
    try {
      await api(`/knowledge/${id}`, { method: "PATCH", json: body });
      reload();
      onChanged();
      setEditing(false);
    } catch (e) {
      setErr(errText(e));
    }
  }

  async function remove() {
    if (!confirm("이 지식을 삭제할까요?")) return;
    try {
      await api(`/knowledge/${id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (e) {
      setErr(errText(e));
    }
  }

  return (
    <Modal open onClose={onClose} title="지식 상세" wide>
      {error && <Alert>{error}</Alert>}
      {k && (
        <div className="space-y-4 text-sm">
          {editing ? (
            <div className="space-y-3">
              <Field label="제목"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
              <Field label="카테고리"><input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
              <Field label="내용"><textarea className={`${inputCls} h-60`} value={content} onChange={(e) => setContent(e.target.value)} /></Field>
              <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(false)}>취소</Button><Button variant="primary" onClick={() => patch({ title, content, category })}>저장</Button></div>
            </div>
          ) : (
            <>
              <div>
                <div className="text-base font-semibold">{k.title}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone="accent">{k.category}</Badge>
                  <Badge tone={VERIFICATION[k.verification]?.tone}>{VERIFICATION[k.verification]?.label}</Badge>
                  <Confidence value={k.confidence} />
                  <Badge>{SRC[k.source_type] ?? k.source_type}</Badge>
                </div>
                <div className="mt-1.5 break-all text-[11px] text-muted">출처: {k.source || "–"} · 생성 {fmtDate(k.created_at)} · 수정 {fmtDate(k.updated_at)} · 대화에서 사용 {k.times_used}회</div>
              </div>
              {!!k.key_points?.length && <div><div className="mb-1 text-xs text-muted">핵심</div><ul className="list-disc space-y-0.5 pl-5">{k.key_points.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
              <div className="max-h-80 overflow-y-auto rounded-lg border border-line bg-panel-2 p-3 scroll-thin"><Markdown text={k.content} /></div>
              {!!k.related?.length && <div><div className="mb-1 text-xs text-muted">관련 지식</div><ul className="space-y-1">{k.related.map((r) => <li key={r.id}><button className="text-accent underline" onClick={() => onOpen(r.id)}>{r.title}</button> <span className="text-xs text-muted">유사도 {(r.similarity * 100).toFixed(0)}%</span></li>)}</ul></div>}
              <div>
                <div className="mb-1 text-xs text-muted">검증 상태 변경</div>
                <div className="flex flex-wrap gap-1.5">{Object.entries(VERIFICATION).map(([v, l]) => <Button key={v} size="sm" variant={k.verification === v ? "primary" : "default"} onClick={() => patch({ verification: v })}>{l.label}</Button>)}</div>
              </div>
              {err && <Alert>{err}</Alert>}
              <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
                {k.learning_record_id && <Link href="/learning" className="mr-auto self-center text-xs text-accent">학습 기록 #{k.learning_record_id}</Link>}
                {k.research_task_id && <Link href="/research" className="mr-auto self-center text-xs text-accent">조사 #{k.research_task_id}</Link>}
                <Button size="sm" onClick={() => { setTitle(k.title); setContent(k.content); setCategory(k.category); setEditing(true); }}><Icon name="edit" className="h-3.5 w-3.5" /> 수정</Button>
                <Button size="sm" variant="danger" onClick={remove}><Icon name="trash" className="h-3.5 w-3.5" /> 삭제</Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
