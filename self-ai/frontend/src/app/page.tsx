"use client";

import Link from "next/link";
import { Alert, Badge, Card, Empty, Page, Spinner, Stat, StatusBadge, fmtBytes, fmtDate } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import type { AIStatus, LearningRecord, LogEntry } from "@/lib/types";

type Dash = {
  ai: AIStatus;
  counts: Record<string, number>;
  recent_learning: LearningRecord[];
  recent_activity: LogEntry[];
  system: {
    uptime_seconds: number; python: string; database: string; database_size: number | null;
    search: { provider: string; label: string; connected: boolean; detail: string };
    external_network_enabled: boolean; access_token_required: boolean;
  };
};

const CAT: Record<string, string> = { chat: "대화", memory: "기억", learning: "학습", research: "조사", evaluation: "평가", autonomy: "자율", settings: "설정", backup: "백업", data: "데이터" };

export default function Dashboard() {
  const { data, error, loading } = useApi<Dash>("/dashboard", 15000);
  if (loading && !data) return <Page title="Dashboard"><div className="flex items-center gap-2 text-sm text-muted"><Spinner /> 불러오는 중…</div></Page>;
  if (error && !data) return <Page title="Dashboard"><Alert>{error}</Alert></Page>;
  if (!data) return null;
  const { ai, counts, system } = data;
  const up = system.uptime_seconds;

  return (
    <Page title="Dashboard" subtitle="모든 숫자는 데이터베이스에 실제로 저장된 값입니다.">
      {!ai.ready && (
        <div className="mb-4"><Alert tone="warn"><b>AI가 연결되지 않았습니다.</b> {ai.error} <Link className="underline" href="/settings">설정 열기</Link></Alert></div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="AI 연결" value={ai.ready ? "연결됨" : "끊김"} tone={ai.ready ? "ok" : "bad"} hint={`${ai.mode} 모드`} />
        <Stat label="현재 모델" value={<span className="text-base">{ai.active?.model ?? "–"}</span>} hint={ai.active?.provider === "cloud" ? "클라우드" : ai.active ? "로컬 (Ollama)" : "없음"} />
        <Stat label="저장된 기억" value={counts.memories} hint="Memory" />
        <Stat label="축적된 지식" value={counts.knowledge} hint="Knowledge" />
        <Stat label="완료된 조사" value={counts.research_completed} hint={`전체 ${counts.research_total}건`} />
        <Stat label="대화" value={counts.conversations} hint={`메시지 ${counts.messages}개`} />
        <Stat label="자기 평가" value={counts.evaluations} hint={`사용자 피드백 ${counts.feedback}개`} />
        <Stat label="승인 대기 작업" value={counts.autonomy_proposed} hint="Autonomy" tone={counts.autonomy_proposed ? undefined : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="최근 학습 기록" className="lg:col-span-2" actions={<Link href="/learning" className="text-xs text-accent">전체 보기</Link>}>
          {data.recent_learning.length === 0 ? <Empty>아직 학습한 자료가 없습니다. <Link href="/learning" className="text-accent">자료 추가</Link></Empty> : (
            <ul className="divide-y divide-line">
              {data.recent_learning.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  <StatusBadge status={r.status} />
                  {r.method && <Badge tone={r.method === "llm" ? "accent" : "muted"}>{r.method === "llm" ? "AI 분석" : "발췌"}</Badge>}
                  <span className="text-xs text-muted">+{r.added} · 중복 {r.duplicates}</span>
                  <span className="w-full text-[11px] text-muted sm:w-auto">{fmtDate(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="시스템 상태">
          <dl className="space-y-2 text-sm">
            {[
              ["로컬 AI (Ollama)", ai.local.available ? <Badge tone="ok">연결됨</Badge> : <Badge tone="bad">연결 안 됨</Badge>],
              ["클라우드 AI", ai.cloud.usable ? <Badge tone="warn">사용 가능</Badge> : <Badge>비활성</Badge>],
              ["웹 검색", system.search.connected ? <Badge tone="ok">{system.search.provider}</Badge> : <Badge tone="warn">연결 필요</Badge>],
              ["외부 네트워크", system.external_network_enabled ? <Badge tone="warn">허용</Badge> : <Badge>차단</Badge>],
              ["접근 토큰", system.access_token_required ? <Badge tone="ok">사용</Badge> : <Badge>미사용</Badge>],
              ["데이터베이스", `${system.database} · ${fmtBytes(system.database_size)}`],
              ["가동 시간", up < 3600 ? `${Math.floor(up / 60)}분` : `${Math.floor(up / 3600)}시간 ${Math.floor((up % 3600) / 60)}분`],
            ].map(([k, v], i) => (
              <div key={i} className="flex items-center justify-between gap-2"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
            ))}
          </dl>
        </Card>
      </div>

      <Card title="최근 활동" className="mt-4">
        {data.recent_activity.length === 0 ? <Empty>기록된 활동이 없습니다.</Empty> : (
          <ul className="space-y-1.5">
            {data.recent_activity.map((l) => (
              <li key={l.id} className="flex items-start gap-2 text-sm">
                <Badge tone={l.level === "error" ? "bad" : l.level === "warn" ? "warn" : "muted"}>{CAT[l.category] ?? l.category}</Badge>
                <span className="min-w-0 flex-1 break-words">{l.message}</span>
                <span className="shrink-0 text-[11px] text-muted">{fmtDate(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}
