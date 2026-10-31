"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Badge, Card, Empty, Page, ScoreBar, Stat, fmtDate } from "@/components/ui";
import type { Evaluation } from "@/lib/types";
import { useApi } from "@/lib/useApi";

type Stats = {
  count: number; failed: number; averages: Record<string, number | null>; trend: { date: string; overall: number; count: number }[];
  rated_pairs: number; mean_abs_gap_self_vs_user: number | null; corrections: number;
};

export default function EvaluationPage() {
  const stats = useApi<Stats>("/evaluations/stats");
  const list = useApi<Evaluation[]>("/evaluations");
  const [open, setOpen] = useState<number | null>(null);
  const s = stats.data;

  return (
    <Page title="Evaluation" subtitle="AI가 자기 답변을 채점한 기록과 사용자 피드백을 비교합니다.">
      <Alert tone="accent">자기 평가는 같은 AI 모델이 매긴 점수라 정답이 아닙니다. 사용자 평점·수정과의 차이를 함께 보세요. 평가 기록이 쌓여도 모델 자체가 발전하지는 않으며, 개선은 지식 추가와 설정 조정으로 이루어집니다.</Alert>
      {(stats.error || list.error) && <div className="mt-3"><Alert>{stats.error || list.error}</Alert></div>}
      {s && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="평가된 답변" value={s.count} hint={s.failed ? `실패 ${s.failed}건` : undefined} />
            <Stat label="평균 종합 점수" value={s.averages.overall?.toFixed(2) ?? "–"} hint="1~5" />
            <Stat label="자기 평가 vs 사용자 평점" value={s.mean_abs_gap_self_vs_user?.toFixed(2) ?? "–"} hint={`평균 차이 · 비교 ${s.rated_pairs}건`} />
            <Stat label="사용자 수정 답변" value={s.corrections} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card title="항목별 평균">
              <div className="space-y-2">
                <ScoreBar label="정확성" value={s.averages.accuracy} /><ScoreBar label="논리성" value={s.averages.logic} />
                <ScoreBar label="근거" value={s.averages.evidence} /><ScoreBar label="관련성" value={s.averages.relevance} />
              </div>
            </Card>
            <Card title="날짜별 종합 점수 (과거 비교)">
              {!s.trend.length ? <Empty>평가 기록이 없습니다.</Empty> : (
                <div className="flex h-36 items-end gap-1.5" role="img" aria-label="날짜별 평균 점수 막대 그래프">
                  {s.trend.map((t) => (
                    <div key={t.date} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${t.date}: ${t.overall} (${t.count}건)`}>
                      <span className="text-[10px] tabular-nums text-muted">{t.overall.toFixed(1)}</span>
                      <div className="w-full max-w-8 rounded-t bg-accent" style={{ height: `${(t.overall / 5) * 100}px` }} />
                      <span className="truncate text-[10px] text-muted">{t.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <Card title="평가 기록" className="mt-4">
        {!list.data?.length ? <Empty>아직 평가된 답변이 없습니다. <Link className="text-accent" href="/chat">대화</Link>하면 자동으로 평가됩니다.</Empty> : (
          <ul className="divide-y divide-line">
            {list.data.map((e) => (
              <li key={e.id} className="py-3">
                <button className="w-full text-left" onClick={() => setOpen(open === e.id ? null : e.id)}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm">{e.question || "(질문 없음)"}</span>
                    {e.status === "completed" ? <Badge tone={e.overall! >= 4 ? "ok" : e.overall! >= 3 ? "warn" : "bad"}>자기 평가 {e.overall?.toFixed(1)}</Badge> : <Badge tone="bad">평가 실패</Badge>}
                    {e.feedback?.map((f) => f.rating != null && <Badge key={f.id} tone={f.rating >= 4 ? "ok" : f.rating >= 3 ? "warn" : "bad"}>사용자 {f.rating}</Badge>)}
                    {e.feedback?.some((f) => f.corrected_answer) && <Badge tone="accent">수정됨</Badge>}
                    {e.grounding?.no_context && <Badge tone="warn">근거 자료 없음</Badge>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">{fmtDate(e.created_at)} · {e.evaluator || "–"}</div>
                </button>
                {open === e.id && (
                  <div className="fade-in mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <div className="space-y-2">
                      {e.status === "completed" ? (
                        <>
                          <ScoreBar label="정확성" value={e.accuracy} /><ScoreBar label="논리성" value={e.logic} />
                          <ScoreBar label="근거" value={e.evidence} /><ScoreBar label="관련성" value={e.relevance} />
                          <div className="text-xs"><span className="text-muted">누락된 정보:</span> {e.missing_info}</div>
                          <div className="text-xs"><span className="text-muted">불확실성:</span> {e.uncertainty}</div>
                          <div className="text-xs"><span className="text-muted">총평:</span> {e.comments}</div>
                        </>
                      ) : <Alert>{e.error}</Alert>}
                    </div>
                    <div className="space-y-2">
                      <div><div className="mb-1 text-xs text-muted">AI 답변</div><div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-panel-2 p-2.5 text-xs scroll-thin">{e.answer}</div></div>
                      {e.feedback?.filter((f) => f.corrected_answer).map((f) => (
                        <div key={f.id}><div className="mb-1 text-xs text-muted">사용자 수정 답변 · 원래 답변과 유사도 {((f.similarity ?? 0) * 100).toFixed(0)}%</div><div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-ok/30 bg-ok/5 p-2.5 text-xs scroll-thin">{f.corrected_answer}</div></div>
                      ))}
                      {e.feedback?.filter((f) => f.comment).map((f) => <div key={f.id} className="text-xs"><span className="text-muted">사용자 의견:</span> {f.comment}</div>)}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}
