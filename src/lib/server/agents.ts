import { chatJson, type Provider } from './llm';
import type { ConceptKind, CriticReport, Flashcard, QuizQuestion, RelationType } from '../types';

export interface Passage {
  n: number;
  filename: string;
  locator: string;
  text: string;
}

export interface ConceptBrief {
  name: string;
  definition: string;
  kind?: ConceptKind;
  prerequisites?: string[];
}

const clip = (value: unknown, max: number) => String(value ?? '').slice(0, max);
const strings = (value: unknown, max = 8): string[] => (Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).slice(0, max) : []);

export function sanitizePassages(value: unknown, maxEach = 2200, maxCount = 14): Passage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxCount).map((item, index) => ({
    n: index + 1,
    filename: clip(item?.filename, 120),
    locator: clip(item?.locator, 40),
    text: clip(item?.text, maxEach),
  }));
}

export function sanitizeConcepts(value: unknown, maxCount = 60): ConceptBrief[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxCount).map((item) => ({
    name: clip(item?.name, 80),
    definition: clip(item?.definition, 300),
    kind: item?.kind,
    prerequisites: strings(item?.prerequisites, 6),
  }));
}

const formatPassages = (passages: Passage[]) => passages.map((p) => `[${p.n}] (${p.filename}, ${p.locator})\n${p.text}`).join('\n\n');

// ---------------------------------------------------------------- Ingestion swarm

export interface ExtractedConcept {
  name: string;
  definition: string;
  kind: ConceptKind;
  importance: number;
  passage_ids: string[];
}

/** Concept Extraction Agent: identifies the core concepts in a batch of passages and anchors each to the passages that support it. */
export async function extractConcepts(p: Provider, passages: { id: string; locator: string; text: string }[]): Promise<ExtractedConcept[]> {
  const system = `You are the Concept Extraction Agent in FlowMind, a learning system for STEM students.
Identify EVERY concept a student must understand to master this material: definitions, techniques, rules, formulas, problems and their remedies. Prefer precise technical terms over generic words.
Rules:
- Be thorough: typically 8 to 18 concepts per batch (roughly one per 60-80 words of technical content). Include named methods, hyperparameters, failure modes (e.g. a named problem) and the techniques that fix them. Skip trivia, people's names and boilerplate.
- Use the canonical short name (e.g. "Learning rate", not "The learning rate hyperparameter").
- kind: "topic" for broad areas, "concept" for core ideas, "detail" for specific techniques, formulas or examples.
- importance: 1 (minor) to 5 (central).
- definition: one or two plain-English sentences written ONLY from the passages.
- passage_ids: ids of the passages that explain the concept.
Return JSON: {"concepts":[{"name":"","definition":"","kind":"concept","importance":3,"passage_ids":["..."]}]}`;
  const user = passages.map((p) => `<passage id="${p.id}" locator="${p.locator}">\n${p.text}\n</passage>`).join('\n');
  const result = await chatJson<{ concepts?: ExtractedConcept[] }>(p, system, user, { maxTokens: 3000 });
  const ids = new Set(passages.map((p) => p.id));
  return (result.concepts ?? [])
    .filter((c) => c && typeof c.name === 'string' && c.name.trim())
    .map((c) => ({
      name: clip(c.name, 80).trim(),
      definition: clip(c.definition, 400).trim(),
      kind: (['topic', 'concept', 'detail'] as const).includes(c.kind) ? c.kind : 'concept',
      importance: Math.min(5, Math.max(1, Math.round(Number(c.importance) || 3))),
      passage_ids: strings(c.passage_ids, 6).filter((id) => ids.has(id)),
    }));
}

export interface MappedRelation {
  source: string;
  target: string;
  type: RelationType;
  label?: string;
}

/** Relationship Mapping Agent: infers how concepts depend on each other and names the material. */
export async function mapRelations(p: Provider, concepts: ConceptBrief[]): Promise<{ title: string; overview: string; relations: MappedRelation[] }> {
  const system = `You are the Relationship Mapping Agent in FlowMind. Given concepts extracted from course material, build a concept graph that shows how ideas connect.
Relation types (direction matters):
- "prerequisite_of": source must be understood before target.
- "part_of": source is a component or subtopic of target.
- "example_of": source is an instance or application of target.
- "related_to": meaningful link that is none of the above (use sparingly).
Rules:
- Use concept names exactly as given.
- Every concept should have at least one relation; aim for 1.2 to 2 relations per concept. No self-loops, no duplicates.
- Prefer "prerequisite_of" to capture learning order: which idea must be understood before another makes sense (e.g. a rule a method relies on, a quantity an algorithm updates, a problem a technique fixes).
- label: 2-5 words describing the link, e.g. "is computed by".
- title: a short name for the material (max 6 words). overview: two sentences on what it teaches.
Return JSON: {"title":"","overview":"","relations":[{"source":"","target":"","type":"prerequisite_of","label":""}]}`;
  const user = concepts.map((c) => `- ${c.name} (${c.kind ?? 'concept'}): ${c.definition}`).join('\n');
  const result = await chatJson<{ title?: string; overview?: string; relations?: MappedRelation[] }>(p, system, user, { maxTokens: 3500 });
  const types: RelationType[] = ['prerequisite_of', 'part_of', 'example_of', 'related_to'];
  return {
    title: clip(result.title, 80) || 'Untitled material',
    overview: clip(result.overview, 500),
    relations: (result.relations ?? [])
      .filter((r) => r && typeof r.source === 'string' && typeof r.target === 'string')
      .map((r) => ({ source: r.source, target: r.target, type: types.includes(r.type) ? r.type : 'related_to', label: clip(r.label, 40) || undefined })),
  };
}

// ---------------------------------------------------------------- Pedagogy swarm

export type TutorMode = 'explain' | 'socratic' | 'simplify';

export interface TutorInput {
  question: string;
  mode: TutorMode;
  language: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  passages: Passage[];
  concepts: ConceptBrief[];
  struggling: string[];
}

export interface TutorDraft {
  answer: string;
  check_question?: string;
  followups: string[];
  concepts_used: string[];
}

const MODE_GUIDE: Record<TutorMode, string> = {
  explain: 'Give a clear, well-structured explanation. Build from prerequisites to the idea itself. Use a short example if the sources contain one.',
  socratic: 'Teach Socratically. Give a brief grounded hint or partial explanation, then guide the learner with one or two leading questions instead of handing over the full answer. If the learner is answering an earlier question, assess their answer against the sources first.',
  simplify: 'Explain as simply as possible for a non-native English speaker: short sentences, everyday analogies, and define every technical term the first time you use it.',
};

/** Teaching Agent: drafts a grounded explanation. When the critic rejected a previous draft its feedback is included. */
export async function teach(p: Provider, input: TutorInput, feedback?: CriticReport): Promise<TutorDraft> {
  const system = `You are the Teaching Agent in FlowMind, a patient tutor for international STEM students.
${MODE_GUIDE[input.mode]}
Grounding rules (strict):
- Use ONLY facts found in the numbered source passages. Cite every factual sentence with [n] markers that refer to those passages.
- If the passages do not contain the answer, say so plainly and suggest what to look for instead. Never invent facts, numbers, or formulas.
- The concept map lists prerequisites; mention a prerequisite when it helps understanding.
- Write the answer in ${input.language}. Keep technical terms in English in parentheses when translating.
- Use Markdown: short paragraphs, bullet lists where useful, **bold** for key terms. 120-260 words.
- Write formulas in LaTeX inside $...$ (inline) or $$...$$ (display).
${input.struggling.length ? `The learner has been struggling with: ${input.struggling.join(', ')}. Take extra care with those.` : ''}
Return JSON: {"answer":"markdown with [n] citations","check_question":"one question that checks understanding","followups":["three short follow-up questions the learner could ask next"],"concepts_used":["concept names from the map"]}`;
  const history = input.history.slice(-6).map((m) => `${m.role === 'user' ? 'Learner' : 'Tutor'}: ${m.content.slice(0, 900)}`).join('\n');
  const concepts = input.concepts.map((c) => `- ${c.name}: ${c.definition}${c.prerequisites?.length ? ` (prerequisites: ${c.prerequisites.join(', ')})` : ''}`).join('\n');
  const revision = feedback
    ? `\n\nYour previous draft was REJECTED by the Critic Agent (score ${feedback.score}/100). Fix these problems:\n${[...feedback.issues, ...feedback.unsupported_claims.map((c) => `Unsupported claim: ${c}`)].map((x) => `- ${x}`).join('\n')}`
    : '';
  const user = `Source passages:\n${formatPassages(input.passages)}\n\nConcept map:\n${concepts || '(none)'}\n\nConversation so far:\n${history || '(new conversation)'}\n\nLearner: ${input.question}${revision}`;
  const draft = await chatJson<TutorDraft>(p, system, user, { temperature: feedback ? 0.1 : 0.3, maxTokens: 1600 });
  return {
    answer: clip(draft.answer, 6000),
    check_question: clip(draft.check_question, 400) || undefined,
    followups: strings(draft.followups, 3).map((f) => f.slice(0, 160)),
    concepts_used: strings(draft.concepts_used, 8),
  };
}

/** Critic Agent (the quality gate): checks a draft for factual drift against the passages before the learner sees it. */
export async function critique(p: Provider, input: TutorInput, draft: TutorDraft, attempt: number): Promise<CriticReport> {
  const system = `You are the Critic Agent (PedagogyValidationChecker) in FlowMind. You are the quality gate between the Teaching Agent and a student.
Check the draft against the numbered source passages:
1. Factual drift: does any sentence state something the passages do not support? List those claims.
2. Grounding: are factual sentences cited with [n] markers that point to passages which actually support them?
3. Pedagogy: does it answer the learner's question clearly and in the requested language?
It is acceptable (and correct) for the draft to say the sources do not cover something.
Score 0-100. verdict "pass" only if there are no unsupported factual claims and score >= 75; otherwise "revise".
Return JSON: {"verdict":"pass","score":90,"issues":["short actionable problems"],"unsupported_claims":["exact claims not backed by the passages"]}`;
  const user = `Source passages:\n${formatPassages(input.passages)}\n\nLearner question: ${input.question}\nRequested language: ${input.language}\n\nDraft answer:\n${draft.answer}`;
  const report = await chatJson<Partial<CriticReport>>(p, system, user, { critic: true, temperature: 0, maxTokens: 900 });
  const score = Math.max(0, Math.min(100, Math.round(Number(report.score) || 0)));
  const unsupported = strings(report.unsupported_claims, 6);
  return {
    attempt,
    verdict: report.verdict === 'pass' && score >= 75 && unsupported.length === 0 ? 'pass' : 'revise',
    score,
    issues: strings(report.issues, 6),
    unsupported_claims: unsupported,
  };
}

// ---------------------------------------------------------------- Study materials

export async function summarize(p: Provider, passages: Passage[], concepts: ConceptBrief[]) {
  const system = `You are the Summary Agent in FlowMind. Write a study summary of the material using ONLY the numbered passages.
- tldr: 2-3 sentences.
- sections: 3-6 sections that follow the material's structure; each with 2-5 concise bullets. Cite each bullet with [n].
- key_terms: 6-12 terms with one-sentence definitions.
- Write formulas in LaTeX inside $...$.
Return JSON: {"title":"","tldr":"","sections":[{"heading":"","bullets":[""]}],"key_terms":[{"term":"","definition":""}]}`;
  const user = `Passages:\n${formatPassages(passages)}\n\nKnown concepts: ${concepts.map((c) => c.name).join(', ')}`;
  const result = await chatJson<{ title?: string; tldr?: string; sections?: { heading: string; bullets: string[] }[]; key_terms?: { term: string; definition: string }[] }>(p, system, user, { maxTokens: 3000 });
  return {
    title: clip(result.title, 100),
    tldr: clip(result.tldr, 800),
    sections: (result.sections ?? []).slice(0, 8).map((s) => ({ heading: clip(s?.heading, 100), bullets: strings(s?.bullets, 6).map((b) => b.slice(0, 500)) })),
    key_terms: (result.key_terms ?? []).slice(0, 14).map((t) => ({ term: clip(t?.term, 80), definition: clip(t?.definition, 300) })),
  };
}

export async function practice(p: Provider, passages: Passage[], concepts: ConceptBrief[], focus?: string) {
  const system = `You are the Quiz Agent in FlowMind. Create practice material grounded ONLY in the numbered passages.
${focus ? `Focus on the concept "${focus}" and its prerequisites.` : 'Cover the most important concepts evenly.'}
- questions: 6 multiple-choice questions that test understanding (not word matching). 4 options each, exactly one correct. Plausible distractors. explanation cites the passage with [n]. concept is the concept name tested.
- flashcards: 8 cards; front is a question or term, back is a concise answer.
- citation: the passage number supporting the item.
- Plain text only in questions, options and flashcards: write math with Unicode symbols (η, ∂L/∂w, σ(z)), never LaTeX.
Return JSON: {"questions":[{"concept":"","question":"","options":["","","",""],"answer_index":0,"explanation":"","citation":1}],"flashcards":[{"front":"","back":"","concept":"","citation":1}]}`;
  const user = `Passages:\n${formatPassages(passages)}\n\nConcepts:\n${concepts.map((c) => `- ${c.name}: ${c.definition}`).join('\n')}`;
  const result = await chatJson<{ questions?: QuizQuestion[]; flashcards?: Flashcard[] }>(p, system, user, { temperature: 0.4, maxTokens: 3500 });
  const questions = (result.questions ?? [])
    .filter((q) => q && Array.isArray(q.options) && q.options.length >= 2)
    .slice(0, 8)
    .map((q) => ({
      concept: clip(q.concept, 80),
      question: clip(q.question, 400),
      options: q.options.slice(0, 5).map((o) => clip(o, 240)),
      answer_index: Math.min(Math.max(0, Math.round(Number(q.answer_index) || 0)), Math.min(q.options.length, 5) - 1),
      explanation: clip(q.explanation, 600),
      citation: Number(q.citation) || undefined,
    }));
  const flashcards = (result.flashcards ?? []).slice(0, 12).map((f) => ({ front: clip(f?.front, 300), back: clip(f?.back, 600), concept: clip(f?.concept, 80), citation: Number(f?.citation) || undefined }));
  return { questions, flashcards };
}

/**
 * Critic pass over a generated quiz: re-derives the correct option for each question from the passages.
 * Wrong answer keys are corrected; questions the passages cannot settle are dropped.
 */
export async function verifyQuiz(p: Provider, passages: Passage[], questions: QuizQuestion[]): Promise<{ questions: QuizQuestion[]; fixed: number; dropped: number }> {
  if (!questions.length) return { questions, fixed: 0, dropped: 0 };
  const system = `You are the Critic Agent checking a multiple-choice quiz against the numbered source passages.
For each question, independently decide which option is the single best answer according to the passages ONLY.
Return JSON: {"results":[{"index":0,"best_option":0,"supported":true}]} where best_option is the 0-based option index and supported is false if the passages do not determine a single correct answer.`;
  const listed = questions.map((q, i) => `${i}. ${q.question}\n${q.options.map((o, j) => `   ${j}) ${o}`).join('\n')}`).join('\n');
  const user = `Passages:\n${formatPassages(passages)}\n\nQuestions:\n${listed}`;
  const report = await chatJson<{ results?: { index: number; best_option: number; supported: boolean }[] }>(p, system, user, { critic: true, temperature: 0, maxTokens: 900 });
  const verdicts = new Map((report.results ?? []).map((r) => [Number(r.index), r]));
  let fixed = 0;
  let dropped = 0;
  const checked: QuizQuestion[] = [];
  questions.forEach((q, i) => {
    const v = verdicts.get(i);
    if (!v) return checked.push(q);
    const best = Math.round(Number(v.best_option));
    if (v.supported === false || !(best >= 0 && best < q.options.length)) {
      dropped++;
      return;
    }
    if (best !== q.answer_index) fixed++;
    checked.push({ ...q, answer_index: best });
  });
  return { questions: checked.length ? checked : questions, fixed, dropped };
}

