'use client';

import { AlertCircle, Braces, Check, FileText, Loader2, Network, Plus, Presentation, ScanText, ShieldCheck, Sparkles, Trash2, GraduationCap, X } from 'lucide-react';
import type { AgentId, AgentStatus, Source } from '@/lib/types';

export const AGENTS: { id: AgentId; name: string; role: string; icon: typeof FileText; swarm: 'ingestion' | 'pedagogy' }[] = [
  { id: 'parsing', name: 'Parsing Agent', role: 'Extracts clean text per page and slide', icon: ScanText, swarm: 'ingestion' },
  { id: 'embedding', name: 'Indexing', role: 'Semantic vectors for hybrid retrieval', icon: Braces, swarm: 'ingestion' },
  { id: 'concepts', name: 'Concept Extraction Agent', role: 'Identifies core concepts → graph nodes', icon: Sparkles, swarm: 'ingestion' },
  { id: 'relations', name: 'Relationship Mapping Agent', role: 'Infers dependencies → graph edges', icon: Network, swarm: 'ingestion' },
  { id: 'teaching', name: 'Teaching Agent', role: 'Grounded explanations and quizzes', icon: GraduationCap, swarm: 'pedagogy' },
  { id: 'critic', name: 'Critic Agent', role: 'Quality gate against hallucination', icon: ShieldCheck, swarm: 'pedagogy' },
];

const SOURCE_ICON = { pdf: FileText, pptx: Presentation, docx: FileText, txt: FileText, md: FileText };

function StateIcon({ state }: { state: AgentStatus['state'] }) {
  if (state === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />;
  if (state === 'done') return <Check className="h-3.5 w-3.5 text-ok" />;
  if (state === 'error') return <AlertCircle className="h-3.5 w-3.5 text-warn" />;
  return <span className="h-1.5 w-1.5 rounded-full bg-line" />;
}

interface Props {
  sources: Source[];
  agents: Record<AgentId, AgentStatus>;
  busy: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onReset: () => void;
  onClose?: () => void;
}

export default function Sidebar({ sources, agents, busy, onAdd, onRemove, onReset, onClose }: Props) {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Sources</h2>
        <div className="flex items-center gap-1">
          <button onClick={onAdd} disabled={busy} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
          {onClose && (
            <button onClick={onClose} className="rounded-md p-1 text-ink-3 hover:bg-panel-2 lg:hidden" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2">
        {sources.length === 0 ? (
          <p className="px-2 py-3 text-xs leading-relaxed text-ink-3">No sources yet. Add lecture PDFs, slide decks, Word docs or notes — they are combined into one concept map.</p>
        ) : (
          <ul className="space-y-0.5">
            {sources.map((s) => {
              const Icon = SOURCE_ICON[s.kind];
              return (
                <li key={s.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-panel-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink" title={s.filename}>
                      {s.filename}
                    </div>
                    <div className="text-[0.7rem] text-ink-3">
                      {s.kind.toUpperCase()} · {s.pages} {s.kind === 'pptx' ? 'slides' : s.kind === 'pdf' ? 'pages' : 'sections'} · {s.words.toLocaleString()} words
                    </div>
                  </div>
                  <button onClick={() => onRemove(s.id)} disabled={busy} className="rounded-md p-1 text-ink-3 opacity-0 hover:bg-panel hover:text-bad group-hover:opacity-100" aria-label={`Remove ${s.filename}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <h2 className="mt-5 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Agent pipeline</h2>
        {(['ingestion', 'pedagogy'] as const).map((swarm) => (
          <div key={swarm} className="mb-3">
            <div className="px-2 pb-1 text-[0.66rem] font-medium uppercase tracking-wider text-ink-3/80">{swarm === 'ingestion' ? 'Ingestion swarm' : 'Pedagogy swarm'}</div>
            <ol className="relative">
              {AGENTS.filter((a) => a.swarm === swarm).map((agent, i, list) => {
                const status = agents[agent.id];
                const Icon = agent.icon;
                return (
                  <li key={agent.id} className="relative flex gap-2.5 rounded-lg px-2 py-1.5">
                    {i < list.length - 1 && <span className="absolute left-[23px] top-9 h-[calc(100%-22px)] w-px bg-line" />}
                    <span className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${status.state === 'running' ? 'border-accent/40 bg-accent-soft text-accent' : status.state === 'done' ? 'border-ok/30 bg-ok-soft text-ok' : status.state === 'error' ? 'border-warn/30 bg-warn-soft text-warn' : 'border-line bg-panel text-ink-3'}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[0.8rem] font-medium text-ink">{agent.name}</span>
                        <StateIcon state={status.state} />
                      </div>
                      <div className={`truncate text-[0.7rem] ${status.state === 'running' ? 'fm-pulse text-accent' : 'text-ink-3'}`} title={status.detail || agent.role}>
                        {status.detail || agent.role}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
      {sources.length > 0 && (
        <div className="border-t border-line p-3">
          <button onClick={onReset} disabled={busy} className="w-full rounded-lg px-3 py-1.5 text-xs font-medium text-ink-3 hover:bg-panel-2 hover:text-bad disabled:opacity-50">
            Clear workspace
          </button>
        </div>
      )}
    </aside>
  );
}
