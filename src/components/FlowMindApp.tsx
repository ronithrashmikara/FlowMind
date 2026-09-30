'use client';

import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { BookOpenCheck, FileText, FlaskConical, GraduationCap, KeyRound, Library, Moon, Network, Sun, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ConceptMap from './ConceptMap';
import ConceptPanel from './ConceptPanel';
import Logo from './Logo';
import Sidebar, { AGENTS } from './Sidebar';
import { PracticeView, SummaryView } from './StudyViews';
import TutorPanel, { type TutorRun } from './TutorPanel';
import { getUserKey, passagePayload, post, runIngestion, setUserKey, stream } from '@/lib/client';
import { ACCEPTED, newId, parseFile } from '@/lib/parse';
import { coverage, prerequisitesOf, retrieve } from '@/lib/retrieval';
import type { TutorMode } from '@/lib/server/agents';
import { emptyWorkspace, type AgentId, type AgentStatus, type Chunk, type Citation, type Concept, type CriticReport, type Mastery, type PracticeSet, type SummaryResult, type TutorAnswer, type Workspace } from '@/lib/types';

const STORE_KEY = 'flowmind.workspace.v3';
const SAMPLE = { url: '/samples/Neural-Networks-Lecture-4.pdf', name: 'Neural-Networks-Lecture-4.pdf' };

type View = 'map' | 'summary' | 'practice';
type MobilePane = 'sources' | 'main' | 'tutor';

const idleAgents = (): Record<AgentId, AgentStatus> => Object.fromEntries(AGENTS.map((a) => [a.id, { state: 'idle' }])) as Record<AgentId, AgentStatus>;

const toCitations = (chunks: Chunk[]): Citation[] => chunks.map((c, i) => ({ n: i + 1, chunkId: c.id, filename: c.filename, locator: c.locator, text: c.text }));

function readyAgents(ws: Workspace): Record<AgentId, AgentStatus> {
  const agents = idleAgents();
  if (!ws.sources.length) return agents;
  agents.parsing = { state: 'done', detail: `${ws.sources.length} source${ws.sources.length > 1 ? 's' : ''} · ${ws.chunks.length} passages` };
  agents.embedding = ws.chunks.some((c) => c.embedding) ? { state: 'done', detail: `${ws.chunks.filter((c) => c.embedding).length} passages · semantic index` } : { state: 'error', detail: 'Keyword search only' };
  agents.concepts = { state: 'done', detail: `${ws.concepts.length} concepts` };
  agents.relations = { state: 'done', detail: `${ws.relations.length} links` };
  return agents;
}

export default function FlowMindApp() {
  const [ws, setWs] = useState<Workspace>(emptyWorkspace);
  const [loaded, setLoaded] = useState(false);
  const [agents, setAgents] = useState(idleAgents);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>('map');
  const [pane, setPane] = useState<MobilePane>('main');
  const [selected, setSelected] = useState<string | null>(null);
  const [viewer, setViewer] = useState<Citation | null>(null);
  const [run, setRun] = useState<TutorRun | null>(null);
  const [mode, setMode] = useState<TutorMode>('explain');
  const [language, setLanguage] = useState('English');
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [settings, setSettings] = useState(false);
  const [serverKey, setServerKey] = useState<boolean | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const fileInput = useRef<HTMLInputElement>(null);
  const wsRef = useRef(ws);
  wsRef.current = ws;

  // Restore the workspace from IndexedDB; everything also works without persistence.
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    fetch('/api/status')
      .then((r) => r.json())
      .then((s) => {
        setServerKey(Boolean(s.serverKey));
        setModel(s.model);
      })
      .catch(() => setServerKey(false));
    idbGet<Workspace>(STORE_KEY)
      .then((saved) => {
        if (saved?.version === 3) {
          setWs(saved);
          setAgents(readyAgents(saved));
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => idbSet(STORE_KEY, ws).catch(() => undefined), 400);
    return () => clearTimeout(id);
  }, [ws, loaded]);

  const report = useCallback((agent: AgentId, status: AgentStatus) => setAgents((a) => ({ ...a, [agent]: status })), []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('flowmind.theme', next);
    } catch {
      /* ignore */
    }
  };

  const ingest = useCallback(
    async (files: File[]) => {
      if (!files.length || busy) return;
      setBusy(true);
      setNotice(null);
      setPane('main');
      setView('map');
      setAgents((a) => ({ ...idleAgents(), teaching: a.teaching, critic: a.critic }));
      try {
        report('parsing', { state: 'running', detail: `Reading ${files[0].name}` });
        const parsed: Awaited<ReturnType<typeof parseFile>>[] = [];
        const problems: string[] = [];
        for (const file of files) {
          report('parsing', { state: 'running', detail: `Reading ${file.name}` });
          try {
            parsed.push(await parseFile(file));
          } catch (error) {
            problems.push((error as Error).message);
          }
        }
        if (!parsed.length) throw new Error(problems.join(' '));
        const fresh = parsed.flatMap((p) => p.chunks);
        const pages = parsed.reduce((sum, p) => sum + p.source.pages, 0);
        report('parsing', { state: 'done', detail: `${pages} pages/slides · ${fresh.length} passages` });
        const base: Workspace = { ...wsRef.current, sources: [...wsRef.current.sources, ...parsed.map((p) => p.source)], chunks: [...wsRef.current.chunks, ...fresh] };
        setWs(base);
        const next = await runIngestion(base, fresh, report);
        setWs(next);
        if (problems.length) setNotice(problems.join(' '));
      } catch (error) {
        const message = (error as Error).message;
        setNotice(message);
        setAgents((a) => {
          const updated = { ...a };
          for (const id of Object.keys(updated) as AgentId[]) if (updated[id].state === 'running') updated[id] = { state: 'error', detail: message.slice(0, 80) };
          return updated;
        });
        if (/api key/i.test(message)) setSettings(true);
      } finally {
        setBusy(false);
      }
    },
    [busy, report],
  );

  const loadSample = async () => {
    const response = await fetch(SAMPLE.url);
    const blob = await response.blob();
    ingest([new File([blob], SAMPLE.name, { type: 'application/pdf' })]);
  };

  const removeSource = (id: string) => {
    setWs((w) => {
      const chunks = w.chunks.filter((c) => c.sourceId !== id);
      const alive = new Set(chunks.map((c) => c.id));
      const concepts = w.concepts.map((c) => ({ ...c, chunkIds: c.chunkIds.filter((x) => alive.has(x)) })).filter((c) => c.chunkIds.length);
      const ids = new Set(concepts.map((c) => c.id));
      const sources = w.sources.filter((s) => s.id !== id);
      return sources.length ? { ...w, sources, chunks, concepts, relations: w.relations.filter((r) => ids.has(r.source) && ids.has(r.target)), summary: undefined, practice: undefined } : emptyWorkspace();
    });
    setSelected(null);
  };

  const reset = () => {
    setWs(emptyWorkspace());
    setAgents(idleAgents());
    setSelected(null);
    setView('map');
    idbDel(STORE_KEY).catch(() => undefined);
  };

  const ask = useCallback(
    async (question: string) => {
      const current = wsRef.current;
      if (!current.chunks.length || run) return;
      setPane('tutor');
      const userMessage = { id: newId('msg'), role: 'user' as const, content: question };
      setWs((w) => ({ ...w, chat: [...w.chat, userMessage] }));
      const steps: TutorRun['steps'] = [{ key: 'retrieve', label: 'Hybrid retrieval: semantic + keyword + graph', state: 'running' }];
      const update = (s: TutorRun['steps']) => setRun({ question, steps: [...s] });
      update(steps);
      report('teaching', { state: 'running', detail: 'Waiting for context' });
      report('critic', { state: 'idle', detail: 'Waiting for draft' });

      try {
        let vector: number[] | null = null;
        if (current.chunks.some((c) => c.embedding)) {
          try {
            vector = (await post<{ vectors: number[][] }>('/api/embed', { texts: [question] })).vectors[0];
          } catch {
            vector = null;
          }
        }
        const { passages, concepts } = retrieve(current, question, vector);
        const struggling = current.concepts.filter((c) => current.progress[c.id]?.mastery === 'struggling').map((c) => c.name);
        steps[0] = { key: 'retrieve', label: `Retrieved ${passages.length} passages · ${concepts.length} linked concepts`, state: 'done' };
        update(steps);

        let result = null as TutorAnswer | null;
        let failure = '';
        await stream(
          '/api/agents/tutor',
          {
            question,
            mode,
            language,
            history: current.chat.slice(-6).map((m) => ({ role: m.role, content: m.role === 'assistant' ? m.result?.answer ?? '' : m.content })),
            passages: passagePayload(passages),
            concepts: concepts.map((c) => ({ name: c.name, definition: c.definition, kind: c.kind, prerequisites: prerequisitesOf(c.id, current.relations).map((id) => current.concepts.find((x) => x.id === id)?.name).filter(Boolean) })),
            struggling,
          },
          (event) => {
            if (event.type === 'stage') {
              const attempt = Number(event.attempt);
              if (event.agent === 'teaching') {
                steps.push({ key: `t${attempt}`, label: attempt === 1 ? 'Teaching Agent drafting a grounded answer' : `Teaching Agent revising (draft ${attempt})`, state: 'running' });
                report('teaching', { state: 'running', detail: attempt === 1 ? 'Drafting answer' : `Revising · draft ${attempt}` });
              } else {
                steps[steps.length - 1].state = 'done';
                steps.push({ key: `c${attempt}`, label: `Critic Agent checking draft ${attempt} against sources`, state: 'running' });
                report('critic', { state: 'running', detail: `Validating draft ${attempt}` });
              }
              update(steps);
            } else if (event.type === 'critic') {
              const r = event.report as CriticReport;
              steps[steps.length - 1] = { key: `c${r.attempt}`, label: r.verdict === 'pass' ? `Critic passed draft ${r.attempt} · ${r.score}/100` : `Critic rejected draft ${r.attempt} · ${r.score}/100 — sending back`, state: r.verdict === 'pass' ? 'done' : 'warn' };
              update(steps);
            } else if (event.type === 'final') {
              result = { ...(event.result as Omit<TutorAnswer, 'citations'>), citations: toCitations(passages) } as TutorAnswer;
            } else if (event.type === 'error') {
              failure = String(event.error);
            }
          },
        );
        if (!result) throw new Error(failure || 'The tutor did not return an answer.');
        const answer: TutorAnswer = result;
        const last = answer.critic[answer.critic.length - 1];
        report('teaching', { state: 'done', detail: `Answered in ${answer.attempts} draft${answer.attempts > 1 ? 's' : ''}` });
        report('critic', { state: answer.verified ? 'done' : 'error', detail: answer.verified ? `Verified · ${last?.score}/100` : `Unverified · ${last?.score}/100` });
        setWs((w) => ({ ...w, chat: [...w.chat, { id: newId('msg'), role: 'assistant', content: answer.answer, result: answer }] }));
      } catch (error) {
        const message = (error as Error).message;
        report('teaching', { state: 'error', detail: message.slice(0, 80) });
        setWs((w) => ({ ...w, chat: [...w.chat, { id: newId('msg'), role: 'assistant', content: '', error: message }] }));
        if (/api key/i.test(message)) setSettings(true);
      } finally {
        setRun(null);
      }
    },
    [run, mode, language, report],
  );

  const generateSummary = async () => {
    setSummaryBusy(true);
    try {
      const passages = coverage(wsRef.current, 18);
      const result = await post<Omit<SummaryResult, 'citations'>>('/api/agents/summary', { passages: passagePayload(passages), concepts: wsRef.current.concepts.slice(0, 30).map((c) => ({ name: c.name, definition: c.definition })) });
      setWs((w) => ({ ...w, summary: { ...result, title: result.title || w.title, citations: toCitations(passages) } }));
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setSummaryBusy(false);
    }
  };

  const generatePractice = async (focus?: string) => {
    setPracticeBusy(true);
    setView('practice');
    setPane('main');
    try {
      const current = wsRef.current;
      const target = focus ? current.concepts.find((c) => c.name === focus) : undefined;
      const related = target ? [target, ...prerequisitesOf(target.id, current.relations).map((id) => current.concepts.find((c) => c.id === id)).filter(Boolean)] as Concept[] : current.concepts.slice(0, 16);
      const passages = coverage(current, 12, related.flatMap((c) => c.chunkIds.slice(0, 3)));
      const result = await post<Omit<PracticeSet, 'citations' | 'focus'>>('/api/agents/practice', { passages: passagePayload(passages), concepts: related.map((c) => ({ name: c.name, definition: c.definition })), focus });
      setWs((w) => ({ ...w, practice: { ...result, focus, citations: toCitations(passages) } }));
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setPracticeBusy(false);
    }
  };

  const recordAnswer = (conceptName: string, correct: boolean) => {
    setWs((w) => {
      const key = conceptName.toLowerCase();
      const concept = w.concepts.find((c) => c.name.toLowerCase() === key) ?? w.concepts.find((c) => key.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(key));
      if (!concept) return w;
      const prev = w.progress[concept.id] ?? { correct: 0, wrong: 0, mastery: 'new' as Mastery };
      const next = { correct: prev.correct + (correct ? 1 : 0), wrong: prev.wrong + (correct ? 0 : 1) };
      const mastery: Mastery = next.wrong > next.correct ? 'struggling' : next.correct >= 2 && next.correct > next.wrong ? 'mastered' : 'learning';
      return { ...w, progress: { ...w.progress, [concept.id]: { ...next, mastery } } };
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    ingest(Array.from(e.dataTransfer.files));
  };

  const hasContent = ws.concepts.length > 0;
  const selectedConcept = ws.concepts.find((c) => c.id === selected);
  const mastered = Object.values(ws.progress).filter((p) => p.mastery === 'mastered').length;
  const needsKey = serverKey === false && !getUserKey();

  const tabs: { id: View; label: string; icon: typeof Network }[] = [
    { id: 'map', label: 'Concept map', icon: Network },
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'practice', label: 'Practice', icon: BookOpenCheck },
  ];

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-bg"
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
    >
      <input ref={fileInput} type="file" accept={ACCEPTED} multiple hidden onChange={(e) => { ingest(Array.from(e.target.files ?? [])); e.target.value = ''; }} />

      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
        <Logo />
        <span className="text-[0.95rem] font-semibold tracking-tight text-ink">FlowMind</span>
        {ws.title && (
          <>
            <span className="hidden h-5 w-px bg-line sm:block" />
            <span className="hidden min-w-0 truncate text-sm text-ink-2 sm:block" title={ws.overview}>
              {ws.title}
            </span>
          </>
        )}
        {hasContent && (
          <span className="ml-1 hidden rounded-full bg-panel-2 px-2 py-0.5 text-[0.7rem] font-medium text-ink-3 md:inline">
            {ws.concepts.length} concepts · {mastered} mastered
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {model && !getUserKey() && (
            <span className="mr-2 hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[0.7rem] font-medium text-ink-3 xl:inline-flex" title="Model used by all agents">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              {model.split('/').pop()}
            </span>
          )}
          <button onClick={() => fileInput.current?.click()} disabled={busy} className="hidden items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-60 sm:inline-flex">
            <Upload className="h-4 w-4" /> Add sources
          </button>
          <button onClick={() => setSettings(true)} className={`relative rounded-lg p-2 hover:bg-panel-2 ${needsKey ? 'text-warn' : 'text-ink-3 hover:text-ink'}`} title="Model API key">
            <KeyRound className="h-4.5 w-4.5" />
            {needsKey && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warn" />}
          </button>
          <button onClick={toggleTheme} className="rounded-lg p-2 text-ink-3 hover:bg-panel-2 hover:text-ink" title="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>
        </div>
      </header>

      {notice && (
        <div className="flex items-start gap-2 border-b border-warn/30 bg-warn-soft px-4 py-2 text-sm text-ink">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-ink-3 hover:text-ink" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className={`${pane === 'sources' ? 'flex' : 'hidden'} w-full shrink-0 border-r border-line lg:flex lg:w-[272px]`}>
          <div className="w-full">
            <Sidebar sources={ws.sources} agents={agents} busy={busy} onAdd={() => fileInput.current?.click()} onRemove={removeSource} onReset={reset} onClose={() => setPane('main')} />
          </div>
        </div>

        <main className={`${pane === 'main' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col lg:flex`}>
          {ws.sources.length > 0 && (
            <nav className="flex h-11 shrink-0 items-center gap-1 border-b border-line bg-panel px-3">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setView(t.id)} className={`relative inline-flex h-11 items-center gap-1.5 px-3 text-sm font-medium transition-colors ${view === t.id ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`}>
                  <t.icon className="h-4 w-4" />
                  {t.label}
                  {view === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
                </button>
              ))}
            </nav>
          )}
          <div className="relative min-h-0 flex-1">
            {!loaded ? null : !ws.sources.length && !busy ? (
              <div className="grid h-full place-items-center overflow-y-auto p-6">
                <div className="w-full max-w-xl">
                  <button onClick={() => fileInput.current?.click()} className="group flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-line bg-panel px-8 py-12 text-center transition-colors hover:border-accent/60 hover:bg-accent-soft/30">
                    <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent transition-transform group-hover:scale-105">
                      <Upload className="h-6 w-6" />
                    </span>
                    <span className="text-base font-semibold text-ink">Drop lecture PDFs, slides or notes</span>
                    <span className="mt-1 text-sm text-ink-3">PDF · PPTX · DOCX · Markdown · TXT — parsed in your browser, combined into one concept map</span>
                  </button>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-xs text-ink-3">or</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <button onClick={loadSample} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-left hover:border-accent/50">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-panel-2 text-ink-2">
                      <FlaskConical className="h-4.5 w-4.5" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-ink">Try the sample lecture</span>
                      <span className="block text-xs text-ink-3">Neural Networks — Lecture 4 · 4-page PDF</span>
                    </span>
                  </button>
                </div>
              </div>
            ) : !hasContent ? (
              <div className="grid h-full place-items-center p-6">
                <div className="w-full max-w-sm space-y-2">
                  {AGENTS.slice(0, 4).map((a) => {
                    const s = agents[a.id];
                    return (
                      <div key={a.id} className={`flex items-center gap-3 rounded-xl border bg-panel px-4 py-3 transition-all ${s.state === 'running' ? 'border-accent/40 shadow-md' : 'border-line'} ${s.state === 'idle' ? 'opacity-50' : ''}`}>
                        <a.icon className={`h-5 w-5 ${s.state === 'done' ? 'text-ok' : s.state === 'running' ? 'text-accent' : s.state === 'error' ? 'text-warn' : 'text-ink-3'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-ink">{a.name}</div>
                          <div className={`truncate text-xs ${s.state === 'running' ? 'fm-pulse text-accent' : 'text-ink-3'}`}>{s.detail || a.role}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : view === 'map' ? (
              <>
                <ConceptMap concepts={ws.concepts} relations={ws.relations} progress={ws.progress} selected={selected} onSelect={setSelected} />
                {selectedConcept && (
                  <ConceptPanel
                    concept={selectedConcept}
                    concepts={ws.concepts}
                    relations={ws.relations}
                    chunks={ws.chunks}
                    progress={ws.progress[selectedConcept.id]}
                    onClose={() => setSelected(null)}
                    onSelect={setSelected}
                    onAsk={ask}
                    onPractice={(c) => generatePractice(c.name)}
                    onOpenPassage={(c) => setViewer({ n: 0, chunkId: c.id, filename: c.filename, locator: c.locator, text: c.text })}
                  />
                )}
              </>
            ) : view === 'summary' ? (
              <SummaryView summary={ws.summary} busy={summaryBusy} onGenerate={generateSummary} onCite={setViewer} />
            ) : (
              <PracticeView practice={ws.practice} busy={practiceBusy} concepts={ws.concepts} onGenerate={generatePractice} onAnswer={recordAnswer} onCite={setViewer} />
            )}
          </div>
        </main>

        <div className={`${pane === 'tutor' ? 'flex' : 'hidden'} w-full shrink-0 border-l border-line lg:flex lg:w-[380px] xl:w-[420px]`}>
          <div className="w-full">
            <TutorPanel
              enabled={hasContent}
              messages={ws.chat}
              run={run}
              mode={mode}
              language={language}
              concepts={ws.concepts}
              onMode={setMode}
              onLanguage={setLanguage}
              onAsk={ask}
              onCite={setViewer}
              onClear={() => setWs((w) => ({ ...w, chat: [] }))}
            />
          </div>
        </div>
      </div>

      <nav className="grid h-14 shrink-0 grid-cols-3 border-t border-line bg-panel lg:hidden">
        {(
          [
            ['sources', 'Sources', Library],
            ['main', 'Study', Network],
            ['tutor', 'Tutor', GraduationCap],
          ] as const
        ).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setPane(id)} className={`flex flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium ${pane === id ? 'text-accent' : 'text-ink-3'}`}>
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-accent/10 backdrop-blur-[2px]">
          <div className="rounded-2xl border-2 border-dashed border-accent bg-panel px-10 py-8 text-center shadow-xl">
            <Upload className="mx-auto mb-2 h-7 w-7 text-accent" />
            <div className="font-semibold text-ink">Drop to add to your library</div>
          </div>
        </div>
      )}

      {viewer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setViewer(null)}>
          <div className="fm-in w-full max-w-xl rounded-2xl border border-line bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
              {viewer.n > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-md bg-accent-soft px-1 text-xs font-semibold text-accent">{viewer.n}</span>}
              <FileText className="h-4 w-4 text-ink-3" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{viewer.filename}</span>
              <span className="rounded-md bg-panel-2 px-2 py-0.5 text-xs font-medium text-ink-2">{viewer.locator}</span>
              <button onClick={() => setViewer(null)} className="rounded-md p-1 text-ink-3 hover:bg-panel-2" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="scroll-thin max-h-[60vh] overflow-y-auto whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-ink-2">{viewer.text}</p>
          </div>
        </div>
      )}

      {settings && <SettingsDialog serverKey={serverKey} onClose={() => setSettings(false)} />}
    </div>
  );
}

function SettingsDialog({ serverKey, onClose }: { serverKey: boolean | null; onClose: () => void }) {
  const [value, setValue] = useState(getUserKey);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        className="fm-in w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          setUserKey(value.trim());
          onClose();
        }}
      >
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-accent" />
          <h2 className="font-semibold text-ink">Model API key</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          {serverKey ? 'This deployment has a server key, so you can leave this empty. ' : 'This deployment has no server key. '}
          A key entered here stays in this browser and is sent only to this site’s API routes, which forward it to OpenRouter or Mistral.
        </p>
        <input value={value} onChange={(e) => setValue(e.target.value)} type="password" autoComplete="off" placeholder="OpenRouter (sk-or-…) or Mistral key" className="mt-4 w-full rounded-lg border border-line bg-panel-2/60 px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
        <div className="mt-4 flex justify-end gap-2">
          {getUserKey() && (
            <button type="button" onClick={() => { setUserKey(''); onClose(); }} className="mr-auto rounded-lg px-3 py-1.5 text-sm text-ink-3 hover:text-bad">
              Remove key
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-panel-2">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
