'use client';

import { ArrowUp, Check, ChevronDown, GraduationCap, Languages, Lightbulb, Loader2, RotateCcw, Search, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Markdown from './Markdown';
import type { ChatMessage, Citation, Concept, CriticReport } from '@/lib/types';
import type { TutorMode } from '@/lib/server/agents';

export interface TutorRun {
  question: string;
  steps: { key: string; label: string; state: 'running' | 'done' | 'warn' }[];
}

export const LANGUAGES = ['English', 'Sinhala', 'Tamil', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Chinese (Simplified)', 'Japanese', 'Korean'];

const MODES: { id: TutorMode; label: string; hint: string }[] = [
  { id: 'explain', label: 'Explain', hint: 'Clear, structured explanations' },
  { id: 'socratic', label: 'Socratic', hint: 'Guides you with questions' },
  { id: 'simplify', label: 'Simplify', hint: 'Plain language, analogies' },
];

interface Props {
  enabled: boolean;
  messages: ChatMessage[];
  run: TutorRun | null;
  mode: TutorMode;
  language: string;
  concepts: Concept[];
  onMode: (mode: TutorMode) => void;
  onLanguage: (language: string) => void;
  onAsk: (question: string) => void;
  onCite: (citation: Citation) => void;
  onClear: () => void;
}

function CriticBadge({ verified, attempts, reports }: { verified: boolean; attempts: number; reports: CriticReport[] }) {
  const [open, setOpen] = useState(false);
  const last = reports[reports.length - 1];
  return (
    <div className="mt-3">
      <button onClick={() => setOpen(!open)} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-medium ${verified ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>
        {verified ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
        {verified ? 'Verified by Critic Agent' : 'Critic could not fully verify'} · {last?.score ?? 0}/100
        {attempts > 1 && ` · ${attempts - 1} revision${attempts > 2 ? 's' : ''}`}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ol className="fm-in mt-2 space-y-2 border-l-2 border-line pl-3 text-xs text-ink-2">
          {reports.map((r) => (
            <li key={r.attempt}>
              <div className="font-medium text-ink">
                Draft {r.attempt}: {r.verdict === 'pass' ? 'passed' : 'sent back for revision'} ({r.score}/100)
              </div>
              {[...r.unsupported_claims.map((c) => `Unsupported: ${c}`), ...r.issues].slice(0, 4).map((issue, i) => (
                <div key={i} className="mt-0.5 text-ink-3">
                  – {issue}
                </div>
              ))}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function TutorPanel({ enabled, messages, run, mode, language, concepts, onMode, onLanguage, onAsk, onCite, onClear }: Props) {
  const [input, setInput] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, run?.steps.length]);

  const submit = (text = input) => {
    const q = text.trim();
    if (!q || run || !enabled) return;
    setInput('');
    onAsk(q);
  };

  const top = [...concepts].sort((a, b) => b.importance - a.importance);
  const starters = top.length >= 2 ? [`Explain ${top[0].name} simply`, `How does ${top[1].name} relate to ${top[0].name}?`, `What should I learn before ${top[Math.min(2, top.length - 1)].name}?`] : [];

  return (
    <section className="flex h-full min-h-0 flex-col bg-panel">
      <header className="border-b border-line px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4.5 w-4.5 text-accent" />
          <h2 className="text-sm font-semibold text-ink">AI Tutor</h2>
          <span className="text-[0.7rem] text-ink-3">Teaching Agent + Critic</span>
          {messages.length > 0 && (
            <button onClick={onClear} disabled={Boolean(run)} className="ml-auto rounded-md p-1 text-ink-3 hover:bg-panel-2 hover:text-ink" title="Clear conversation">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 rounded-lg bg-panel-2 p-0.5">
            {MODES.map((m) => (
              <button key={m.id} onClick={() => onMode(m.id)} title={m.hint} className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${mode === m.id ? 'bg-panel text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'}`}>
                {m.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 rounded-lg bg-panel-2 px-2 py-1" title="Answer language">
            <Languages className="h-3.5 w-3.5 text-ink-3" />
            <select value={language} onChange={(e) => onLanguage(e.target.value)} className="max-w-[88px] bg-transparent text-xs font-medium text-ink-2 outline-none">
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div ref={scroller} className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!messages.length && !run && (
          <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-ink">{enabled ? 'Ask anything about your material' : 'Add a source to start tutoring'}</p>
            <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-ink-3">
              Every answer is drafted from your sources, cited, and checked by the Critic Agent before you see it.
            </p>
            {enabled && starters.length > 0 && (
              <div className="mt-4 flex w-full flex-col gap-1.5">
                {starters.map((s) => (
                  <button key={s} onClick={() => submit(s)} className="rounded-lg border border-line px-3 py-2 text-left text-xs text-ink-2 hover:border-accent/50 hover:bg-accent-soft/40">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, index) =>
          m.role === 'user' ? (
            <div key={m.id} className="fm-in flex justify-end">
              <div className="max-w-[88%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-sm text-accent-ink">{m.content}</div>
            </div>
          ) : (
            <div key={m.id} className="fm-in">
              {m.error ? (
                <div className="rounded-xl border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad">{m.error}</div>
              ) : (
                m.result && (
                  <div>
                    <Markdown text={m.result.answer} max={m.result.citations.length} onCite={(n) => m.result && m.result.citations[n - 1] && onCite(m.result.citations[n - 1])} />
                    {m.result.check_question && (
                      <div className="mt-3 flex gap-2 rounded-xl border border-accent/25 bg-accent-soft/50 p-3 text-sm">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <div>
                          <div className="text-[0.68rem] font-semibold uppercase tracking-wider text-accent">Check yourself</div>
                          <div className="mt-0.5 [&_.prose-fm]:text-ink"><Markdown text={m.result.check_question} /></div>
                        </div>
                      </div>
                    )}
                    <CriticBadge verified={m.result.verified} attempts={m.result.attempts} reports={m.result.critic} />
                    {index === messages.length - 1 && !run && m.result.followups.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {m.result.followups.map((f) => (
                          <button key={f} onClick={() => submit(f)} className="rounded-full border border-line px-2.5 py-1 text-left text-xs text-ink-2 hover:border-accent/50 hover:text-accent">
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          ),
        )}

        {run && (
          <div className="fm-in rounded-xl border border-line bg-panel-2/60 p-3">
            <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-3">Pedagogy swarm</div>
            <ol className="space-y-1.5">
              {run.steps.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-xs text-ink-2">
                  {s.state === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> : s.state === 'warn' ? <RotateCcw className="h-3.5 w-3.5 text-warn" /> : s.key === 'retrieve' ? <Search className="h-3.5 w-3.5 text-ok" /> : <Check className="h-3.5 w-3.5 text-ok" />}
                  <span className={s.state === 'running' ? 'text-ink' : ''}>{s.label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-line p-3"
      >
        <div className="flex items-end gap-2 rounded-xl border border-line bg-panel-2/60 p-1.5 focus-within:border-accent/60">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            disabled={!enabled}
            placeholder={enabled ? (mode === 'socratic' ? 'Ask, or answer the tutor’s question…' : 'Ask about your sources…') : 'Add a source first'}
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-ink outline-none placeholder:text-ink-3"
          />
          <button type="submit" disabled={!input.trim() || Boolean(run) || !enabled} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink disabled:opacity-35" aria-label="Send">
            {run ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </section>
  );
}
