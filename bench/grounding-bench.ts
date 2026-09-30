/**
 * FlowMind grounding benchmark. Drives a running FlowMind server through the same client code the browser uses:
 *   1. ingestion swarm on the sample lecture (concept recall vs. a gold list, gold prerequisite-link recall)
 *   2. retrieval: answer-bearing passage hit@8, keyword-only vs. hybrid (semantic + keyword + graph)
 *   3. pedagogy swarm: answer accuracy, abstention on out-of-scope questions, citation validity,
 *      critic pass/revision rates, multilingual answers, latency
 *   4. quiz agent: structural validity and judged answer-key correctness
 *
 * Usage: npm run dev  (in another terminal), then  npm run bench  [BASE=http://localhost:3000]
 * An LLM judge (same provider as the server, via OPENROUTER_API_KEY / MISTRAL_API_KEY in .env.local) scores
 * abstention and answer keys; keyword checks are deterministic.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { segmentsToChunks } from '../src/lib/parse';
import { retrieve, prerequisitesOf } from '../src/lib/retrieval';
import { passagePayload, post, runIngestion, stream } from '../src/lib/client';
import { emptyWorkspace, type CriticReport, type Workspace } from '../src/lib/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE || 'http://localhost:3000';
const dataset = JSON.parse(readFileSync(join(root, 'bench', 'dataset.json'), 'utf8'));

// The client code uses same-origin paths; point them at the server under test.
const nativeFetch = globalThis.fetch;
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => nativeFetch(typeof input === 'string' && input.startsWith('/') ? BASE + input : input, init)) as typeof fetch;

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}
loadEnv();

const lower = (s: string) => s.toLowerCase();
const seconds = (ms: number) => Math.round(ms / 100) / 10;
const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};
const log = (...args: unknown[]) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args);

type GoldQuestion = { q: string; all?: string[][]; any?: string[]; any_n?: number };

function keywordCorrect(text: string, item: GoldQuestion) {
  const t = lower(text);
  if (item.all) return item.all.every((group) => group.some((k) => t.includes(lower(k))));
  if (item.any) return item.any.filter((k) => t.includes(lower(k))).length >= (item.any_n ?? 1);
  return false;
}

async function judge(system: string, user: string): Promise<Record<string, unknown> | null> {
  const orKey = process.env.OPENROUTER_API_KEY;
  const mKey = process.env.MISTRAL_API_KEY;
  if (!orKey && !mKey) return null;
  const openrouter = Boolean(orKey);
  const body: Record<string, unknown> = {
    model: openrouter ? process.env.OPENROUTER_MODEL || 'stealth/space-bunny-alpha' : process.env.MISTRAL_MODEL || 'mistral-small-latest',
    temperature: 0,
    max_tokens: openrouter ? 3000 : 400,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (openrouter) body.reasoning = { effort: 'low', exclude: true };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await nativeFetch(openrouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${orKey || mKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      const content: string = data.choices?.[0]?.message?.content ?? '';
      return JSON.parse(content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1));
    } catch {
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
    }
  }
  return null;
}

async function pdfSegments(path: string) {
  const require = createRequire(import.meta.url);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'file://' + require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs').replace(/\\/g, '/');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)) }).promise;
  const segments = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    segments.push({ locator: `p. ${i}`, text: content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join('') });
  }
  return segments;
}

interface TutorOutcome {
  answer: string;
  verified: boolean;
  attempts: number;
  critic: CriticReport[];
  citations: number[];
  passages: number;
  ms: number;
  error?: string;
}

async function askTutor(ws: Workspace, question: string, language = 'English', mode = 'explain'): Promise<TutorOutcome> {
  const started = Date.now();
  let vector: number[] | null = null;
  try {
    vector = (await post<{ vectors: number[][] }>('/api/embed', { texts: [question] })).vectors[0];
  } catch {
    vector = null;
  }
  const { passages, concepts } = retrieve(ws, question, vector);
  let final: { answer: string; verified: boolean; attempts: number; critic: CriticReport[] } | null = null;
  let error = '';
  try {
    await stream(
      '/api/agents/tutor',
      {
        question,
        mode,
        language,
        history: [],
        passages: passagePayload(passages),
        concepts: concepts.map((c) => ({ name: c.name, definition: c.definition, kind: c.kind, prerequisites: prerequisitesOf(c.id, ws.relations).map((id) => ws.concepts.find((x) => x.id === id)?.name).filter(Boolean) })),
        struggling: [],
      },
      (event) => {
        if (event.type === 'final') final = event.result as typeof final;
        if (event.type === 'error') error = String(event.error);
      },
    );
  } catch (e) {
    error = (e as Error).message;
  }
  const result = final as { answer: string; verified: boolean; attempts: number; critic: CriticReport[] } | null;
  const answer = result?.answer ?? '';
  const citations = [...answer.matchAll(/\[(\d+(?:\s*[,;]\s*\d+)*)\]/g)].flatMap((m) => m[1].split(/[,;]/).map((n) => Number(n.trim())));
  return { answer, verified: Boolean(result?.verified), attempts: result?.attempts ?? 0, critic: result?.critic ?? [], citations, passages: passages.length, ms: Date.now() - started, error: result ? undefined : error || 'no answer' };
}

async function pool<T, R>(items: T[], size: number, work: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await work(items[i], i); } }));
  return out;
}

async function main() {
  const status = await (await fetch('/api/status')).json();
  if (!status.serverKey) throw new Error('The server under test has no model key configured.');
  log(`FlowMind bench against ${BASE} · ${status.provider} · ${status.model} · embeddings ${status.embedModel}`);

  // 1. Ingestion swarm
  const t0 = Date.now();
  const segments = await pdfSegments(join(root, dataset.source));
  const { source, chunks } = segmentsToChunks('Neural-Networks-Lecture-4.pdf', 'pdf', segments);
  const parseMs = Date.now() - t0;
  const stageTimes: Record<string, number> = {};
  let stageStart = Date.now();
  let ws: Workspace = { ...emptyWorkspace(), sources: [source], chunks };
  ws = await runIngestion(ws, chunks, (agent, s) => {
    if (s.state === 'done' || s.state === 'error') {
      stageTimes[agent] = Date.now() - stageStart;
      stageStart = Date.now();
      log(`  ${agent}: ${s.state} — ${s.detail}`);
    }
  });
  const ingestMs = Date.now() - t0;
  const names = ws.concepts.map((c) => lower(c.name));
  const conceptHits = (dataset.gold_concepts as string[][]).map((aliases) => ({ gold: aliases[0], found: names.some((n) => aliases.some((a) => n.includes(lower(a)))) }));
  const nameOf = new Map(ws.concepts.map((c) => [c.id, lower(c.name)]));
  const linkHits = (dataset.gold_links as [string, string][]).map(([a, b]) => ({
    gold: `${a} → ${b}`,
    found: ws.relations.some((r) => {
      const s = nameOf.get(r.source) ?? '';
      const t = nameOf.get(r.target) ?? '';
      return (s.includes(a) && t.includes(b)) || (s.includes(b) && t.includes(a));
    }),
  }));
  log(`ingestion: ${ws.concepts.length} concepts, ${ws.relations.length} links in ${seconds(ingestMs)}s; gold concept recall ${pct(conceptHits.filter((h) => h.found).length, conceptHits.length)}%`);

  // 2. Retrieval: is an answer-bearing passage among the passages sent to the tutor?
  const retrieval = await pool(dataset.answerable, 3, async (item: GoldQuestion) => {
    let vector: number[] | null = null;
    try {
      vector = (await post<{ vectors: number[][] }>('/api/embed', { texts: [item.q] })).vectors[0];
    } catch {
      vector = null;
    }
    const hybrid = retrieve(ws, item.q, vector).passages.map((p) => p.text).join('\n');
    const keyword = retrieve(ws, item.q, null).passages.map((p) => p.text).join('\n');
    return { q: item.q, hybrid: keywordCorrect(hybrid, item), keyword: keywordCorrect(keyword, item) };
  });

  // 3. Pedagogy swarm
  log('tutor: answerable questions');
  const answerable = await pool(dataset.answerable, 2, async (item: GoldQuestion) => {
    const r = await askTutor(ws, item.q);
    log(`  ${r.verified ? '✓' : '·'} ${seconds(r.ms)}s ${keywordCorrect(r.answer, item) ? 'correct' : 'MISS'} — ${item.q}`);
    return { ...r, q: item.q, correct: keywordCorrect(r.answer, item) };
  });
  log('tutor: out-of-scope questions');
  const unanswerable = await pool(dataset.unanswerable as string[], 2, async (q) => {
    const r = await askTutor(ws, q);
    const verdict = await judge(
      'You grade a tutor that must answer ONLY from a lecture on training neural networks (neurons, activations, losses, gradient descent, backpropagation, regularisation). The question is NOT covered by that lecture. Return JSON {"abstained": true|false, "fabricated_facts": true|false}. abstained=true if the answer clearly says the sources/lecture do not contain the answer (it may still point to related lecture content). fabricated_facts=true if it states specific facts that answer the question (numbers, names, formulas) as if known.',
      `Question: ${q}\n\nTutor answer:\n${r.answer}`,
    );
    const heuristic = /(do(es)? not|don't|doesn't|not (covered|included|mentioned|provided|contain|state|specif)|no (information|mention)|isn't|is not (covered|in)|cannot answer|can't answer|not in (the|your) (sources|lecture|material))/i.test(r.answer);
    const abstained = verdict ? Boolean(verdict.abstained) : heuristic;
    log(`  ${abstained ? 'abstained' : 'ANSWERED'} — ${q}`);
    return { ...r, q, abstained, fabricated: verdict ? Boolean(verdict.fabricated_facts) : !heuristic, judged: Boolean(verdict) };
  });
  log('tutor: multilingual');
  const multilingual = await pool(dataset.multilingual, 2, async (item: { q: string; language: string; script?: string; keywords?: string[] }) => {
    const r = await askTutor(ws, item.q, item.language);
    const ok = item.script ? new RegExp(item.script).test(r.answer) : (item.keywords ?? []).some((k) => lower(r.answer).includes(k));
    return { ...r, q: item.q, language: item.language, inLanguage: ok };
  });

  // 4. Quiz agent
  log('quiz agent');
  const quizStart = Date.now();
  const quizPassages = chunks.slice(0, 12);
  const quiz = await post<{ questions: { question: string; options: string[]; answer_index: number; explanation: string }[]; flashcards: unknown[]; verification: { fixed: number; dropped: number } | null }>('/api/agents/practice', {
    passages: passagePayload(quizPassages),
    concepts: ws.concepts.slice(0, 16).map((c) => ({ name: c.name, definition: c.definition })),
  });
  const quizMs = Date.now() - quizStart;
  const structural = quiz.questions.filter((q) => q.options.length === 4 && new Set(q.options.map(lower)).size === 4 && q.answer_index >= 0 && q.answer_index < 4).length;
  const keyCheck = await judge(
    'You check multiple-choice answer keys against lecture passages. For each question decide whether the option marked correct is the single best answer according to the passages. Return JSON {"results":[{"index":0,"key_correct":true}]}.',
    `Passages:\n${quizPassages.map((p, i) => `[${i + 1}] ${p.text}`).join('\n\n')}\n\nQuestions:\n${quiz.questions.map((q, i) => `${i}. ${q.question}\n${q.options.map((o, j) => `   ${String.fromCharCode(65 + j)}. ${o}`).join('\n')}\n   Marked correct: ${String.fromCharCode(65 + q.answer_index)}`).join('\n')}`,
  );
  const keysCorrect = Array.isArray(keyCheck?.results) ? (keyCheck!.results as { key_correct: boolean }[]).filter((r) => r.key_correct).length : null;

  // Aggregate
  const tutorRuns = [...answerable, ...unanswerable, ...multilingual];
  const ok = tutorRuns.filter((r) => !r.error);
  const citedAnswers = answerable.filter((r) => r.citations.length > 0);
  const validCitations = answerable.filter((r) => r.citations.length > 0 && r.citations.every((n) => n >= 1 && n <= r.passages));
  const firstDraftPass = ok.filter((r) => r.critic[0]?.verdict === 'pass').length;
  const results = {
    date: new Date().toISOString(),
    server: { base: BASE, provider: status.provider, model: status.model, embeddings: status.embedModel },
    ingestion: {
      source: dataset.source,
      pages: source.pages,
      passages: chunks.length,
      concepts: ws.concepts.length,
      links: ws.relations.length,
      title: ws.title,
      gold_concept_recall_pct: pct(conceptHits.filter((h) => h.found).length, conceptHits.length),
      gold_link_recall_pct: pct(linkHits.filter((h) => h.found).length, linkHits.length),
      parse_s: seconds(parseMs),
      stage_s: Object.fromEntries(Object.entries(stageTimes).map(([k, v]) => [k, seconds(v)])),
      total_s: seconds(ingestMs),
      missed_concepts: conceptHits.filter((h) => !h.found).map((h) => h.gold),
      missed_links: linkHits.filter((h) => !h.found).map((h) => h.gold),
    },
    retrieval: {
      questions: retrieval.length,
      keyword_only_hit_pct: pct(retrieval.filter((r) => r.keyword).length, retrieval.length),
      hybrid_hit_pct: pct(retrieval.filter((r) => r.hybrid).length, retrieval.length),
    },
    tutor: {
      answerable: answerable.length,
      answer_accuracy_pct: pct(answerable.filter((r) => r.correct).length, answerable.length),
      answers_with_citations_pct: pct(citedAnswers.length, answerable.length),
      citations_in_range_pct: pct(validCitations.length, citedAnswers.length),
      out_of_scope: unanswerable.length,
      abstention_pct: pct(unanswerable.filter((r) => r.abstained).length, unanswerable.length),
      fabrication_on_out_of_scope_pct: pct(unanswerable.filter((r) => r.fabricated).length, unanswerable.length),
      abstention_judged_by_llm: unanswerable.every((r) => r.judged),
      multilingual_in_target_language_pct: pct(multilingual.filter((r) => r.inLanguage).length, multilingual.length),
      critic_first_draft_pass_pct: pct(firstDraftPass, ok.length),
      critic_final_verified_pct: pct(ok.filter((r) => r.verified).length, ok.length),
      drafts_revised_pct: pct(ok.filter((r) => r.attempts > 1).length, ok.length),
      mean_critic_score: Math.round(ok.reduce((s, r) => s + (r.critic.at(-1)?.score ?? 0), 0) / Math.max(1, ok.length)),
      latency_p50_s: seconds(quantile(ok.map((r) => r.ms), 0.5)),
      latency_p90_s: seconds(quantile(ok.map((r) => r.ms), 0.9)),
      errors: tutorRuns.filter((r) => r.error).map((r) => r.error),
    },
    quiz: { questions: quiz.questions.length, flashcards: quiz.flashcards.length, critic_fixed_keys: quiz.verification?.fixed ?? null, critic_dropped: quiz.verification?.dropped ?? null, structurally_valid_pct: pct(structural, quiz.questions.length), answer_key_correct_pct: keysCorrect === null ? null : pct(keysCorrect, quiz.questions.length), latency_s: seconds(quizMs) },
    details: {
      retrieval,
      answerable: answerable.map((r) => ({ q: r.q, correct: r.correct, verified: r.verified, attempts: r.attempts, score: r.critic.at(-1)?.score, s: seconds(r.ms), answer: r.answer })),
      out_of_scope: unanswerable.map((r) => ({ q: r.q, abstained: r.abstained, fabricated: r.fabricated, verified: r.verified, answer: r.answer })),
      multilingual: multilingual.map((r) => ({ q: r.q, language: r.language, inLanguage: r.inLanguage, answer: r.answer })),
    },
  };

  const dir = join(root, 'bench', 'results');
  mkdirSync(dir, { recursive: true });
  const stamp = results.date.slice(0, 16).replace(/[:T]/g, '-');
  writeFileSync(join(dir, `${stamp}.json`), JSON.stringify(results, null, 2));
  writeFileSync(join(dir, 'latest.json'), JSON.stringify(results, null, 2));
  const { details: _details, ...summary } = results;
  void _details;
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
