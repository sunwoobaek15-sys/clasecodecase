"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Alert, Badge, Button, Card, Empty, Field, Modal, Page, StatusBadge, fmtDate, inputCls } from "@/components/ui";
import { api, errText } from "@/lib/api";
import type { LearningRecord } from "@/lib/types";
import { useApi } from "@/lib/useApi";

type Pack = { id: string; title: string; description: string; sections: number; imported: number; titles: string[] };

function StarterPacks({ onStarted }: { onStarted: () => void }) {
  const { data, error, reload } = useApi<Pack[]>("/learning/packs", 5000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load(p: Pack) {
    setBusy(p.id);
    setErr(null);
    try {
      await api(`/learning/packs/${p.id}/import`, { method: "POST" });
      onStarted();
      reload();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="기본 지식 팩" className="mt-4">
      <p className="mb-3 text-sm text-muted">SELF AI와 함께 들어 있는 입문 자료입니다. 불러오면 일반 학습과 같은 과정(요약·중복 제거·비교)을 거쳐 지식에 저장됩니다. 직접 쓴 자료가 아니므로 <b>미검증</b>으로 표시되니, 중요한 내용은 Knowledge에서 확인한 뒤 &quot;사용자 확인&quot;으로 바꾸세요. 이미 불러온 부분은 다시 만들지 않습니다.</p>
      {(error || err) && <Alert>{err || error}</Alert>}
      <div className="grid gap-3 md:grid-cols-3">
        {data?.map((p) => {
          const done = p.imported >= p.sections;
          return (
            <div key={p.id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-line p-3">
              <div className="text-sm font-medium">{p.title}</div>
              <div className="text-xs text-muted">{p.description}</div>
              <div className="text-[11px] text-muted">{p.titles.join(" · ")}</div>
              <div className="mt-auto flex items-center gap-2 pt-1">
                <Badge tone={done ? "ok" : p.imported ? "accent" : "muted"}>{p.imported}/{p.sections}</Badge>
                <Button size="sm" className="ml-auto" variant={done ? "default" : "primary"} loading={busy === p.id} disabled={done} onClick={() => load(p)}>
                  {done ? "불러옴" : p.imported ? "나머지 불러오기" : "불러오기"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function LearningPage() {
  const recs = useApi<LearningRecord[]>("/learning/records", 4000);
  const [tab, setTab] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      if (tab === "text") {
        await api("/learning/text", { method: "POST", json: { text, title: title || null, category: category || null } });
        setText("");
        setTitle("");
      } else if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("category", category);
        await api("/learning/file", { method: "POST", body: fd });
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
      }
      recs.reload();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Learning" subtitle="자료를 분석해 핵심을 뽑고, 기존 지식과 비교해 중복은 버리고 새 지식만 저장합니다.">
      <Alert tone="accent">학습은 <b>지식 데이터베이스에 저장</b>하는 방식입니다. AI 모델 자체(가중치)를 재훈련하지 않습니다. 저장된 지식은 대화할 때 검색되어 답변에 사용됩니다.</Alert>
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2" title="자료 입력">
          <div className="mb-3 flex gap-1.5">
            <Button size="sm" variant={tab === "text" ? "primary" : "default"} onClick={() => setTab("text")}>텍스트</Button>
            <Button size="sm" variant={tab === "file" ? "primary" : "default"} onClick={() => setTab("file")}>파일 업로드</Button>
          </div>
          <div className="space-y-3">
            {tab === "text" ? (
              <>
                <Field label="제목 (선택)"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} /></Field>
                <Field label="내용" hint={`${text.length.toLocaleString()}자 · 최소 20자`}><textarea className={`${inputCls} h-48`} value={text} onChange={(e) => setText(e.target.value)} placeholder="학습할 자료를 붙여 넣으세요" /></Field>
              </>
            ) : (
              <Field label="파일" hint="txt, md, csv, json, html, pdf, docx(Word) · 최대 5MB · 파일은 실행되지 않고 텍스트만 읽습니다">
                <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-panel-2 file:px-3 file:py-2 file:text-sm file:text-text" />
              </Field>
            )}
            <Field label="카테고리 (선택)" hint="비워 두면 AI가 분류합니다 (AI 연결 시)"><input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={100} /></Field>
            {err && <Alert>{err}</Alert>}
            <Button variant="primary" className="w-full" loading={busy} disabled={tab === "text" ? text.trim().length < 20 : !file} onClick={submit}>
              <Icon name="upload" className="h-4 w-4" /> 학습 실행
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-3" title="학습 이력">
          {recs.error && <Alert>{recs.error}</Alert>}
          {!recs.data?.length ? <Empty>학습 기록이 없습니다.</Empty> : (
            <ul className="divide-y divide-line">
              {recs.data.map((r) => (
                <li key={r.id}>
                  <button className="w-full py-3 text-left" onClick={() => setDetail(r.id)}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.title}</span>
                      <StatusBadge status={r.status} />
                      {r.method && <Badge tone={r.method === "llm" ? "accent" : "muted"} title={r.method === "llm" ? "AI가 요약·핵심을 추출" : "AI 없이 문장 점수로 발췌"}>{r.method === "llm" ? "AI 분석" : "발췌 요약"}</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {r.status === "completed" ? `조각 ${r.chunks_total} · 새 지식 ${r.added} · 중복 ${r.duplicates} · 관련 ${r.related}` : r.error ?? "처리 중…"}
                      {" · "}{r.source_type === "file" ? "파일" : r.source_type === "starter" ? "기본 자료" : "텍스트"} · {fmtDate(r.created_at)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <StarterPacks onStarted={recs.reload} />
      {detail != null && <Detail id={detail} onClose={() => setDetail(null)} onDeleted={() => { setDetail(null); recs.reload(); }} />}
    </Page>
  );
}

function Detail({ id, onClose, onDeleted }: { id: number; onClose: () => void; onDeleted: () => void }) {
  const { data, error } = useApi<LearningRecord>(`/learning/records/${id}`);
  async function remove(withKnowledge: boolean) {
    if (!confirm(withKnowledge ? "학습 기록과 이 자료로 만든 지식을 모두 삭제할까요?" : "학습 기록만 삭제할까요? (지식은 남습니다)")) return;
    try {
      await api(`/learning/records/${id}?delete_knowledge=${withKnowledge}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      alert(errText(e));
    }
  }
  const REL: Record<string, string> = { same: "같은 내용", adds: "새 정보 추가", conflict: "충돌", unrelated: "무관" };
  return (
    <Modal open onClose={onClose} title="학습 결과" wide>
      {error && <Alert>{error}</Alert>}
      {data && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-1.5"><b className="mr-1">{data.title}</b><StatusBadge status={data.status} />{data.method && <Badge tone="accent">{data.method === "llm" ? "AI 분석" : "발췌 요약 (AI 미사용)"}</Badge>}<Badge>{data.category}</Badge></div>
          {data.error && <Alert>{data.error}</Alert>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["글자 수", data.chars.toLocaleString()], ["새 지식", data.added], ["중복 제외", data.duplicates], ["관련 지식", data.related]].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-panel-2 p-2.5"><div className="text-[11px] text-muted">{k}</div><div className="text-lg font-semibold">{v}</div></div>
            ))}
          </div>
          {data.summary && <div><div className="mb-1 text-xs text-muted">요약</div><p>{data.summary}</p></div>}
          {!!data.key_points?.length && <div><div className="mb-1 text-xs text-muted">핵심 내용</div><ul className="list-disc space-y-1 pl-5">{data.key_points.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
          {!!data.comparison?.length && (
            <div>
              <div className="mb-1 text-xs text-muted">기존 지식과 비교</div>
              <ul className="space-y-1.5">
                {data.comparison.map((c, i) => (
                  <li key={i} className="rounded-lg border border-line p-2 text-xs">
                    조각 {c.chunk}: {c.result === "duplicate" ? <Badge tone="warn">중복 — 저장 안 함</Badge> : <Badge tone={c.relation === "conflict" ? "bad" : "accent"}>관련{c.similarity != null ? ` ${(c.similarity * 100).toFixed(0)}%` : ""}{c.relation ? ` · ${REL[c.relation]}` : ""}</Badge>}
                    {" "}<Link className="underline" href={`/knowledge?id=${c.knowledge_id}`}>{c.knowledge_title}</Link>{c.note && <div className="mt-1 text-muted">{c.note}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!data.knowledge?.length && <div><div className="mb-1 text-xs text-muted">생성된 지식</div><ul className="space-y-1">{data.knowledge.map((k) => <li key={k.id}><Link className="text-accent underline" href={`/knowledge?id=${k.id}`}>{k.title}</Link></li>)}</ul></div>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
            <Button size="sm" variant="danger" onClick={() => remove(false)}>기록만 삭제</Button>
            <Button size="sm" variant="danger" onClick={() => remove(true)}>기록과 지식 삭제</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
