'use client';

import { BookOpenCheck, Check, ChevronLeft, ChevronRight, FileText, Layers, Loader2, RefreshCw, RotateCw, Target, X } from 'lucide-react';
import { useState } from 'react';
import Markdown from './Markdown';
import type { Citation, Concept, PracticeSet, SummaryResult } from '@/lib/types';

function Generate({ icon: Icon, title, text, busy, onRun, label }: { icon: typeof FileText; title: string; text: string; busy: boolean; onRun: () => void; label: string }) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{text}</p>
        <button onClick={onRun} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? 'Working…' : label}
        </button>
      </div>
    </div>
  );
}

export function SummaryView({ summary, busy, onGenerate, onCite }: { summary?: SummaryResult; busy: boolean; onGenerate: () => void; onCite: (c: Citation) => void }) {
  if (!summary) return <Generate icon={FileText} title="Cited study summary" text="The Summary Agent reads passages from across all your sources and writes a structured summary where every point links back to the page it came from." busy={busy} onRun={onGenerate} label="Generate summary" />;
  const cite = (n: number) => summary.citations[n - 1] && onCite(summary.citations[n - 1]);
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <article className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-accent">Summary</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{summary.title}</h2>
          </div>
          <button onClick={onGenerate} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-panel-2 disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Regenerate
          </button>
        </div>
        <div className="mt-5 rounded-xl border border-accent/20 bg-accent-soft/40 p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">TL;DR</div>
          <Markdown text={summary.tldr} onCite={cite} max={summary.citations.length} />
        </div>
        {summary.sections.map((s, i) => (
          <section key={i} className="mt-7">
            <h3 className="mb-2 text-base font-semibold text-ink">{s.heading}</h3>
            <Markdown text={s.bullets.map((b) => `- ${b}`).join('\n')} onCite={cite} max={summary.citations.length} />
          </section>
        ))}
        {summary.key_terms.length > 0 && (
          <section className="mt-9">
            <h3 className="mb-3 text-base font-semibold text-ink">Key terms</h3>
            <dl className="grid gap-2 sm:grid-cols-2">
              {summary.key_terms.map((t) => (
                <div key={t.term} className="rounded-xl border border-line bg-panel p-3">
                  <dt className="text-sm font-semibold text-ink">{t.term}</dt>
                  <dd className="mt-1 text-xs leading-relaxed text-ink-2">{t.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </article>
    </div>
  );
}

interface PracticeProps {
  practice?: PracticeSet;
  busy: boolean;
  concepts: Concept[];
  onGenerate: (focus?: string) => void;
  onAnswer: (conceptName: string, correct: boolean) => void;
  onCite: (c: Citation) => void;
}

export function PracticeView({ practice, busy, concepts, onGenerate, onAnswer, onCite }: PracticeProps) {
  const [tab, setTab] = useState<'quiz' | 'cards'>('quiz');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [card, setCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [focus, setFocus] = useState('');
  const [seen, setSeen] = useState(practice);

  if (practice !== seen) {
    setSeen(practice);
    setAnswers({});
    setCard(0);
    setFlipped(false);
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2 py-1.5 text-xs text-ink-2">
        <Target className="h-3.5 w-3.5 text-ink-3" />
        <select value={focus} onChange={(e) => setFocus(e.target.value)} className="max-w-[180px] bg-transparent outline-none">
          <option value="">All key concepts</option>
          {concepts.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button onClick={() => onGenerate(focus || undefined)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink disabled:opacity-60">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {practice ? 'New set' : 'Generate'}
      </button>
    </div>
  );

  if (!practice)
    return (
      <div className="flex h-full flex-col">
        <Generate icon={BookOpenCheck} title="Practice that adapts to you" text="The Quiz Agent writes questions and flashcards from your sources. Your answers update the mastery colours on the concept map and tell the tutor where you struggle." busy={busy} onRun={() => onGenerate(focus || undefined)} label="Generate practice set" />
      </div>
    );

  const answered = Object.keys(answers).length;
  const correct = practice.questions.filter((q, i) => answers[i] === q.answer_index).length;
  const cite = (n?: number) => n && practice.citations[n - 1] && onCite(practice.citations[n - 1]);
  const current = practice.flashcards[card];

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg bg-panel-2 p-0.5">
            {(
              [
                ['quiz', `Quiz · ${practice.questions.length}`, BookOpenCheck],
                ['cards', `Flashcards · ${practice.flashcards.length}`, Layers],
              ] as const
            ).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${tab === id ? 'bg-panel text-ink shadow-sm' : 'text-ink-3'}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          {toolbar}
        </div>
        {practice.focus && <p className="mb-4 text-xs text-ink-3">Focused on <span className="font-medium text-ink-2">{practice.focus}</span> and its prerequisites.</p>}

        {tab === 'quiz' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-xs text-ink-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(answered / Math.max(1, practice.questions.length)) * 100}%` }} />
              </div>
              {answered}/{practice.questions.length} answered · {correct} correct
            </div>
            {practice.questions.map((q, qi) => {
              const picked = answers[qi];
              const done = picked !== undefined;
              return (
                <div key={qi} className="fm-in rounded-2xl border border-line bg-panel p-5" style={{ animationDelay: `${qi * 40}ms` }}>
                  <div className="mb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-3">
                    Q{qi + 1} · {q.concept}
                  </div>
                  <p className="text-[0.95rem] font-medium leading-snug text-ink">{q.question}</p>
                  <div className="mt-3 grid gap-2">
                    {q.options.map((option, oi) => {
                      const isAnswer = oi === q.answer_index;
                      const state = !done ? 'idle' : isAnswer ? 'right' : oi === picked ? 'wrong' : 'idle';
                      return (
                        <button
                          key={oi}
                          disabled={done}
                          onClick={() => {
                            setAnswers((a) => ({ ...a, [qi]: oi }));
                            onAnswer(q.concept, isAnswer);
                          }}
                          className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                            state === 'right' ? 'border-ok/50 bg-ok-soft text-ink' : state === 'wrong' ? 'border-bad/50 bg-bad-soft text-ink' : done ? 'border-line text-ink-3' : 'border-line text-ink-2 hover:border-accent/50 hover:bg-accent-soft/40'
                          }`}
                        >
                          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-semibold ${state === 'right' ? 'bg-ok text-white' : state === 'wrong' ? 'bg-bad text-white' : 'bg-panel-2 text-ink-3'}`}>
                            {state === 'right' ? <Check className="h-3.5 w-3.5" /> : state === 'wrong' ? <X className="h-3.5 w-3.5" /> : String.fromCharCode(65 + oi)}
                          </span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {done && (
                    <div className="fm-in mt-3 rounded-xl bg-panel-2/70 p-3">
                      <Markdown text={q.explanation} onCite={() => cite(q.citation)} max={practice.citations.length} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : current ? (
          <div className="flex flex-col items-center">
            <button onClick={() => setFlipped(!flipped)} className="relative h-72 w-full max-w-xl [perspective:1200px]" aria-label="Flip card">
              <div className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-line bg-panel p-8 text-center shadow-sm [backface-visibility:hidden]">
                  <div className="mb-3 text-[0.68rem] font-semibold uppercase tracking-wider text-accent">{current.concept}</div>
                  <p className="text-lg font-medium leading-snug text-ink">{current.front}</p>
                  <span className="absolute bottom-4 inline-flex items-center gap-1 text-xs text-ink-3">
                    <RotateCw className="h-3 w-3" /> Click to reveal
                  </span>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-accent/30 bg-accent-soft/60 p-8 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <p className="text-[0.95rem] leading-relaxed text-ink">{current.back}</p>
                  {current.citation && practice.citations[current.citation - 1] && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        cite(current.citation);
                      }}
                      className="mt-4 text-xs font-medium text-accent underline"
                    >
                      {practice.citations[current.citation - 1].filename} · {practice.citations[current.citation - 1].locator}
                    </span>
                  )}
                </div>
              </div>
            </button>
            <div className="mt-5 flex items-center gap-4">
              <button onClick={() => { setCard((card - 1 + practice.flashcards.length) % practice.flashcards.length); setFlipped(false); }} className="rounded-lg border border-line p-2 text-ink-2 hover:bg-panel-2" aria-label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm tabular-nums text-ink-3">
                {card + 1} / {practice.flashcards.length}
              </span>
              <button onClick={() => { setCard((card + 1) % practice.flashcards.length); setFlipped(false); }} className="rounded-lg border border-line p-2 text-ink-2 hover:bg-panel-2" aria-label="Next">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-3">No flashcards in this set.</p>
        )}
      </div>
    </div>
  );
}
