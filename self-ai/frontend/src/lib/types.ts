export type ProviderStatus = { name: string; available: boolean; detail: string; models: string[]; model: string | null; reachable: boolean };
export type AIStatus = {
  mode: "AUTO" | "LOCAL" | "CLOUD";
  ready: boolean;
  active: { provider: string; model: string | null } | null;
  error: string | null;
  local: ProviderStatus;
  cloud: ProviderStatus & { usable: boolean };
};

export type Memory = {
  id: number; kind: string; content: string; source: string; importance: number; times_seen: number;
  created_at: string; updated_at: string; last_used_at: string | null; score?: number;
};

export type Knowledge = {
  id: number; title: string; category: string; source_type: string; source: string; confidence: number;
  verification: string; summary: string | null; key_points: string[]; related_ids: number[]; times_used: number;
  learning_record_id: number | null; research_task_id: number | null; created_at: string; updated_at: string;
  content: string; score?: number; related?: { id: number; title: string; similarity: number }[];
};

export type LearningRecord = {
  id: number; title: string; source_type: string; source_name: string; status: string; method: string | null;
  chars: number; chunks_total: number; added: number; duplicates: number; related: number; summary: string | null;
  key_points: string[] | null; error: string | null; category: string; created_at: string; updated_at: string;
  comparison: { chunk: number; result: string; knowledge_id: number; knowledge_title: string; similarity?: number; relation?: string; note?: string }[] | null;
  knowledge?: Knowledge[];
};

export type ResearchSource = {
  id: number; kind: string; title: string; url: string; snippet: string; query: string; reliability: number;
  reliability_notes: string[]; has_content: boolean;
};

export type ResearchTask = {
  id: number; topic: string; status: string; progress: number; stage_message: string | null;
  plan: { questions: string[]; queries: string[] }[] | null; plan_method: string | null; search_provider: string | null;
  report?: string | null; report_method: string | null; comparison: { type: string; items: string[] }[] | null;
  saved_to_knowledge: boolean; error: string | null; origin: string; created_at: string; updated_at: string;
  source_count: number; sources?: ResearchSource[];
};

export type Evaluation = {
  id: number; message_id: number; question: string; answer: string; accuracy: number | null; logic: number | null;
  evidence: number | null; relevance: number | null; overall: number | null; missing_info: string | null;
  uncertainty: string | null; comments: string | null; evaluator: string; status: string; error: string | null;
  created_at: string; grounding: Grounding | null; feedback?: Feedback[];
};

export type Feedback = { id: number; message_id: number; rating: number | null; comment: string | null; corrected_answer: string | null; similarity: number | null; created_at: string; knowledge_id?: number | null };

export type Grounding = { memories_given: number; knowledge_given: number; citations: string[]; uses_context: boolean; uncertainty_expressed: boolean; no_context: boolean };

export type MessageContext = {
  memories: { ref: string; id: number; kind: string; content: string; score: number }[];
  knowledge: { ref: string; id: number; title: string; source: string; confidence: number; verification: string; score: number }[];
  withheld_for_privacy: boolean;
  grounding: Grounding;
};

export type ChatMessage = {
  id: number | null; role: "user" | "assistant"; content: string; provider?: string | null; model?: string | null;
  latency_ms?: number | null; context?: MessageContext | null; created_at?: string; evaluation?: Evaluation | null; feedback?: Feedback | null;
  streaming?: boolean; unsaved?: boolean;
};

export type LogEntry = { id: number; level: string; category: string; message: string; created_at: string };

export type AutonomyTask = {
  id: number; action: string; title: string; reason: string; payload: Record<string, unknown> | null; risk: string;
  requires_approval: boolean; status: string; result: Record<string, unknown> | null; created_at: string; updated_at: string;
};
