"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Markdown } from "@/components/Markdown";
import { Alert, Badge, Button, Modal, ScoreBar, Spinner, Toggle, fmtDate, inputCls } from "@/components/ui";
import { api, errText } from "@/lib/api";
import type { AIStatus, ChatMessage, Evaluation, Feedback, MessageContext } from "@/lib/types";
import { useApi } from "@/lib/useApi";

type ConvSummary = { id: number; title: string; message_count: number; updated_at: string };
type ChatOut = {
  answer: string; provider: string; model: string; latency_ms: number; context: MessageContext; saved: boolean;
  conversation_id: number | null; user_message_id: number | null; assistant_message_id: number | null; evaluation_pending: boolean;
};

export default function ChatPage() {
  const convs = useApi<ConvSummary[]>("/conversations");
  const ai = useApi<AIStatus>("/ai/status");
  const [cid, setCid] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [q, setQ] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const open = useCallback(async (id: number) => {
    setErr(null);
    setShowList(false);
    try {
      const c = await api<{ id: number; messages: ChatMessage[] }>(`/conversations/${id}`);
      setCid(c.id);
      setMsgs(c.messages);
    } catch (e) {
      setErr(errText(e));
    }
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, sending]);

  // poll for background self-evaluations of the newest answer
  useEffect(() => {
    const pending = msgs.filter((m) => m.role === "assistant" && m.id && !m.evaluation);
    if (!pending.length) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      for (const m of pending) {
        try {
          const ev = await api<Evaluation | null>(`/messages/${m.id}/evaluation`);
          if (ev) setMsgs((cur) => cur.map((x) => (x.id === m.id ? { ...x, evaluation: ev } : x)));
        } catch { /* ignore */ }
      }
      if (tries > 40) clearInterval(t);
    }, 2500);
    return () => clearInterval(t);
  }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setErr(null);
    setSending(true);
    setMsgs((m) => [...m, { id: null, role: "user", content: text }]);
    setInput("");
    try {
      const r = await api<ChatOut>("/chat", { method: "POST", json: { message: text, conversation_id: cid } });
      setMsgs((m) => [
        ...m.slice(0, -1),
        { id: r.user_message_id, role: "user", content: text },
        { id: r.assistant_message_id, role: "assistant", content: r.answer, provider: r.provider, model: r.model, latency_ms: r.latency_ms, context: r.context },
      ]);
      if (r.conversation_id) setCid(r.conversation_id);
      convs.reload();
    } catch (e) {
      setMsgs((m) => m.slice(0, -1));
      setInput(text);
      setErr(errText(e));
      ai.reload();
    } finally {
      setSending(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("이 대화를 삭제할까요? 되돌릴 수 없습니다.")) return;
    try {
      await api(`/conversations/${id}`, { method: "DELETE" });
      if (id === cid) {
        setCid(null);
        setMsgs([]);
      }
      convs.reload();
    } catch (e) {
      setErr(errText(e));
    }
  }

  const list = (convs.data ?? []).filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase()));
  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-3">
        <Button variant="primary" className="w-full" onClick={() => { setCid(null); setMsgs([]); setShowList(false); }}><Icon name="plus" className="h-4 w-4" /> 새 대화</Button>
        <input className={inputCls} placeholder="대화 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3 scroll-thin">
        {list.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted">저장된 대화가 없습니다</li>}
        {list.map((c) => (
          <li key={c.id} className={`group flex items-center rounded-lg ${c.id === cid ? "bg-accent-soft" : "hover:bg-panel-2"}`}>
            <button onClick={() => open(c.id)} className="min-w-0 flex-1 px-3 py-2 text-left">
              <div className={`truncate text-sm ${c.id === cid ? "text-accent" : ""}`}>{c.title}</div>
              <div className="text-[11px] text-muted">{fmtDate(c.updated_at)} · {c.message_count}개</div>
            </button>
            <button aria-label="대화 삭제" onClick={() => remove(c.id)} className="p-2 text-muted opacity-100 hover:text-bad lg:opacity-0 lg:group-hover:opacity-100"><Icon name="trash" className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] lg:h-dvh">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-panel md:block">{sidebar}</aside>
      {showList && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowList(false)} />
          <div className="fade-in absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-panel">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <button className="text-xs text-accent md:hidden" onClick={() => setShowList(true)}>대화 목록</button>
          <div className="min-w-0 flex-1 truncate text-sm text-muted">{cid ? convs.data?.find((c) => c.id === cid)?.title : "새 대화"}</div>
          {ai.data && (ai.data.ready ? <Badge tone="ok">{ai.data.active?.model}</Badge> : <Badge tone="bad">AI 연결 안 됨</Badge>)}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 scroll-thin">
          <div className="mx-auto max-w-3xl space-y-4">
            {ai.data && !ai.data.ready && <Alert tone="warn">{ai.data.error} <Link href="/settings" className="underline">설정</Link></Alert>}
            {msgs.length === 0 && (
              <div className="py-12 text-center">
                <div className="text-lg font-semibold">무엇을 도와드릴까요?</div>
                <p className="mt-2 text-sm text-muted">답변 전에 저장된 기억과 지식을 검색합니다. 사용한 자료는 [M1], [K1]처럼 표시됩니다.<br />
                  &quot;내 이름은 …&quot;, &quot;기억해줘: …&quot;처럼 말하면 기억으로 저장됩니다.</p>
              </div>
            )}
            {msgs.map((m, i) => m.role === "user"
              ? <div key={i} className="fade-in flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-white">{m.content}</div></div>
              : <AssistantMessage key={i} m={m} onUpdate={(u) => setMsgs((cur) => cur.map((x) => (x.id === m.id ? { ...x, ...u } : x)))} />)}
            {sending && <div className="dots flex gap-1 px-2 text-2xl leading-none text-muted" aria-label="답변 생성 중"><span>•</span><span>•</span><span>•</span></div>}
            {err && <Alert>{err}</Alert>}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t border-line bg-panel px-3 py-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} maxLength={20000}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
              placeholder="메시지 입력 · Enter 전송" aria-label="메시지"
              className={`${inputCls} max-h-40 min-h-[42px] resize-none`} />
            <Button variant="primary" onClick={send} loading={sending} disabled={!input.trim()} aria-label="전송" className="h-[42px]"><Icon name="send" className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({ m, onUpdate }: { m: ChatMessage; onUpdate: (u: Partial<ChatMessage>) => void }) {
  const [showCtx, setShowCtx] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const g = m.context?.grounding;
  const ev = m.evaluation;

  async function rate(rating: number) {
    if (!m.id) return;
    try {
      const f = await api<Feedback>(`/messages/${m.id}/feedback`, { method: "POST", json: { rating } });
      onUpdate({ feedback: f });
    } catch (e) {
      alert(errText(e));
    }
  }

  return (
    <div className="fade-in">
      <div className="rounded-2xl rounded-bl-md border border-line bg-panel px-4 py-3"><Markdown text={m.content} /></div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-muted">
        {m.model && <span>{m.provider === "cloud" ? "☁ " : ""}{m.model}{m.latency_ms != null ? ` · ${(m.latency_ms / 1000).toFixed(1)}s` : ""}</span>}
        {g && (g.no_context ? <Badge tone="warn" title="관련 기억·지식 없이 모델 자체 지식으로 답했습니다">근거 자료 없음</Badge>
          : <button onClick={() => setShowCtx(!showCtx)}><Badge tone="accent">기억 {g.memories_given} · 지식 {g.knowledge_given} 참고{g.citations.length ? ` · 인용 ${g.citations.join(",")}` : ""}</Badge></button>)}
        {g?.uncertainty_expressed && <Badge tone="warn">불확실성 표시됨</Badge>}
        {m.context?.withheld_for_privacy && <Badge title="클라우드 AI 사용 중이라 개인 기억·지식을 보내지 않았습니다">개인 자료 미전송</Badge>}
        {ev ? (ev.status === "completed"
          ? <Badge tone={ev.overall! >= 4 ? "ok" : ev.overall! >= 3 ? "warn" : "bad"} title={ev.comments ?? ""}>자기 평가 {ev.overall?.toFixed(1)}/5</Badge>
          : <Badge tone="bad" title={ev.error ?? ""}>평가 실패</Badge>)
          : m.id ? <span className="inline-flex items-center gap-1"><Spinner className="h-3 w-3" /> 평가 중</span> : null}
        {m.id && (
          <span className="ml-auto flex items-center gap-1">
            <button aria-label="좋은 답변" onClick={() => rate(5)} className={`rounded p-1 hover:text-ok ${m.feedback?.rating === 5 ? "text-ok" : ""}`}><Icon name="thumbUp" className="h-4 w-4" /></button>
            <button aria-label="나쁜 답변" onClick={() => rate(1)} className={`rounded p-1 hover:text-bad ${m.feedback?.rating === 1 ? "text-bad" : ""}`}><Icon name="thumbDown" className="h-4 w-4" /></button>
            <button onClick={() => setFbOpen(true)} className="rounded px-1.5 py-0.5 hover:text-text">수정·의견</button>
          </span>
        )}
      </div>
      {showCtx && m.context && (
        <div className="mt-2 space-y-1 rounded-lg border border-line bg-panel-2 p-3 text-xs">
          {m.context.memories.map((x) => <div key={x.ref}><Badge tone="accent">{x.ref}</Badge> <span className="text-muted">기억</span> {x.content}</div>)}
          {m.context.knowledge.map((x) => <div key={x.ref}><Badge tone="accent">{x.ref}</Badge> <span className="text-muted">지식</span> <Link href={`/knowledge?id=${x.id}`} className="underline">{x.title}</Link> <span className="text-muted">신뢰도 {x.confidence.toFixed(2)}</span></div>)}
        </div>
      )}
      {ev?.status === "completed" && showCtx && (
        <div className="mt-2 space-y-1 rounded-lg border border-line bg-panel-2 p-3">
          <ScoreBar label="정확성" value={ev.accuracy} /><ScoreBar label="논리성" value={ev.logic} />
          <ScoreBar label="근거" value={ev.evidence} /><ScoreBar label="관련성" value={ev.relevance} />
          {ev.missing_info && <div className="pt-1 text-xs text-muted">누락: {ev.missing_info}</div>}
        </div>
      )}
      <FeedbackModal open={fbOpen} onClose={() => setFbOpen(false)} m={m} onSaved={(f) => onUpdate({ feedback: f })} />
    </div>
  );
}

function FeedbackModal({ open, onClose, m, onSaved }: { open: boolean; onClose: () => void; m: ChatMessage; onSaved: (f: Feedback) => void }) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [corrected, setCorrected] = useState("");
  const [asKnowledge, setAsKnowledge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const f = await api<Feedback>(`/messages/${m.id}/feedback`, { method: "POST", json: { rating, comment: comment || null, corrected_answer: corrected || null, save_correction_as_knowledge: !!corrected && asKnowledge } });
      onSaved(f);
      setDone(f.knowledge_id ? "저장했습니다. 수정한 답변은 지식으로도 저장되어 다음 대화에서 사용됩니다." : "저장했습니다.");
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="답변 평가·수정">
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-xs text-muted">평점</div>
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <Button key={n} size="sm" variant={rating === n ? "primary" : "default"} onClick={() => setRating(n)}>{n}</Button>)}</div>
        </div>
        <textarea className={`${inputCls} h-20`} placeholder="의견 (선택)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <textarea className={`${inputCls} h-32`} placeholder="올바른 답변을 직접 써 주세요 (선택). 원래 답변과 비교해 기록합니다." value={corrected} onChange={(e) => setCorrected(e.target.value)} />
        {corrected && <Toggle checked={asKnowledge} onChange={setAsKnowledge} label="수정한 답변을 지식으로 저장" hint="'사용자 확인' 상태로 저장되어 이후 답변에 활용됩니다." />}
        {err && <Alert>{err}</Alert>}
        {done && <Alert tone="ok">{done}</Alert>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>닫기</Button><Button variant="primary" loading={busy} onClick={save} disabled={!!done}>저장</Button></div>
      </div>
    </Modal>
  );
}
