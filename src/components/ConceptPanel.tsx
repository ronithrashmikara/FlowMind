'use client';

import { ArrowLeft, ArrowRight, BookOpenCheck, FileText, MessageCircleQuestion, X } from 'lucide-react';
import { RELATION_LABEL } from './ConceptMap';
import type { Chunk, Concept, ConceptProgress, Relation } from '@/lib/types';

interface Props {
  concept: Concept;
  concepts: Concept[];
  relations: Relation[];
  chunks: Chunk[];
  progress?: ConceptProgress;
  onClose: () => void;
  onSelect: (id: string) => void;
  onAsk: (question: string) => void;
  onPractice: (concept: Concept) => void;
  onOpenPassage: (chunk: Chunk) => void;
}

export default function ConceptPanel({ concept, concepts, relations, chunks, progress, onClose, onSelect, onAsk, onPractice, onOpenPassage }: Props) {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const incoming = relations.filter((r) => r.target === concept.id && byId.has(r.source));
  const outgoing = relations.filter((r) => r.source === concept.id && byId.has(r.target));
  const prerequisites = incoming.filter((r) => r.type === 'prerequisite_of');
  const passages = concept.chunkIds.map((id) => chunks.find((c) => c.id === id)).filter(Boolean) as Chunk[];

  const Link = ({ r, id, dir }: { r: Relation; id: string; dir: 'in' | 'out' }) => (
    <button onClick={() => onSelect(id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-panel-2">
      {dir === 'in' ? <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-ink-3" /> : <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-3" />}
      <span className="min-w-0 flex-1 truncate font-medium text-ink">{byId.get(id)?.name}</span>
      <span className="shrink-0 text-[0.7rem] text-ink-3">{dir === 'out' ? r.label || RELATION_LABEL[r.type] : RELATION_LABEL[r.type]}</span>
    </button>
  );

  return (
    <aside className="fm-in absolute inset-y-3 right-3 z-10 flex w-[min(360px,calc(100%-24px))] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-xl">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <div className="min-w-0 flex-1">
          <div className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-3">
            {concept.kind} · importance {concept.importance}/5{progress ? ` · ${progress.correct}✓ ${progress.wrong}✗` : ''}
          </div>
          <h3 className="mt-1 text-lg font-semibold leading-snug text-ink">{concept.name}</h3>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-panel-2 hover:text-ink" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4">
        <p className="text-sm leading-relaxed text-ink-2">{concept.definition}</p>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onAsk(`Explain "${concept.name}" step by step${prerequisites.length ? ', starting from what I need to know first' : ''}.`)} className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:opacity-90">
            <MessageCircleQuestion className="h-4 w-4" /> Explain this
          </button>
          <button onClick={() => onPractice(concept)} className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-panel-2">
            <BookOpenCheck className="h-4 w-4" /> Quiz me
          </button>
        </div>

        {incoming.length > 0 && (
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Builds on</h4>
            {incoming.map((r) => (
              <Link key={r.id} r={r} id={r.source} dir="in" />
            ))}
          </section>
        )}
        {outgoing.length > 0 && (
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Leads to</h4>
            {outgoing.map((r) => (
              <Link key={r.id} r={r} id={r.target} dir="out" />
            ))}
          </section>
        )}

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">In your sources</h4>
          <div className="space-y-2">
            {passages.map((p) => (
              <button key={p.id} onClick={() => onOpenPassage(p)} className="block w-full rounded-lg border border-line bg-panel-2/50 p-3 text-left hover:border-accent/50">
                <div className="mb-1 flex items-center gap-1.5 text-[0.7rem] font-medium text-ink-3">
                  <FileText className="h-3 w-3" />
                  <span className="truncate">{p.filename}</span> · {p.locator}
                </div>
                <p className="line-clamp-3 text-xs leading-relaxed text-ink-2">{p.text}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
