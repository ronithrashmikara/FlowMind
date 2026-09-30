import type { Chunk, Concept, Relation, Workspace } from './types';

const STOP = new Set(
  'a an and are as at be been but by can do does for from has have how i if in into is it its of on or that the their them then there these they this to was were what when where which while who why will with would you your about also not more most such than so we our may using used use each other only both between'.split(' '),
);

export const tokenize = (text: string) => (text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).filter((t) => !STOP.has(t));

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Okapi BM25 over the workspace passages. */
export function bm25(chunks: Chunk[], query: string): Map<string, number> {
  const terms = [...new Set(tokenize(query))];
  const docs = chunks.map((c) => tokenize(c.text));
  const avg = docs.reduce((sum, d) => sum + d.length, 0) / Math.max(docs.length, 1);
  const df = new Map<string, number>();
  for (const doc of docs) for (const t of new Set(doc)) df.set(t, (df.get(t) ?? 0) + 1);
  const scores = new Map<string, number>();
  docs.forEach((doc, i) => {
    const tf = new Map<string, number>();
    for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const t of terms) {
      const f = tf.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (docs.length - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += (idf * f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (doc.length / avg)));
    }
    scores.set(chunks[i].id, score);
  });
  return scores;
}

const normalize = (scores: Map<string, number>) => {
  const max = Math.max(0, ...scores.values());
  return new Map([...scores].map(([k, v]) => [k, max > 0 ? v / max : 0]));
};

export function conceptsMentioned(concepts: Concept[], text: string): Concept[] {
  const lower = text.toLowerCase();
  return concepts.filter((c) => {
    const name = c.name.toLowerCase();
    if (lower.includes(name)) return true;
    const words = tokenize(name);
    return words.length > 1 && words.every((w) => lower.includes(w));
  });
}

export function prerequisitesOf(conceptId: string, relations: Relation[]): string[] {
  return relations.filter((r) => r.type === 'prerequisite_of' && r.target === conceptId).map((r) => r.source);
}

/**
 * Hybrid retrieval: semantic similarity (embeddings) + keyword BM25, then graph expansion that pulls in
 * passages for prerequisite concepts that are logically needed even when they are not textually similar.
 */
export function retrieve(ws: Workspace, query: string, queryVector: number[] | null, limit = 8) {
  const keyword = normalize(bm25(ws.chunks, query));
  const semantic = new Map<string, number>();
  if (queryVector) for (const c of ws.chunks) if (c.embedding) semantic.set(c.id, Math.max(0, cosine(queryVector, c.embedding)));
  const sem = normalize(semantic);
  const hasSemantic = sem.size > 0;
  const ranked = ws.chunks
    .map((c) => ({ chunk: c, score: hasSemantic ? 0.65 * (sem.get(c.id) ?? 0) + 0.35 * (keyword.get(c.id) ?? 0) : keyword.get(c.id) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const relevant = ranked.filter((r) => r.score > 0);
  const direct = (relevant.length ? relevant : ranked).slice(0, Math.max(3, limit - 2)).map((r) => r.chunk);
  const byId = new Map(ws.concepts.map((c) => [c.id, c]));
  const matched = new Map<string, Concept>();
  for (const c of conceptsMentioned(ws.concepts, query)) matched.set(c.id, c);
  const anchors = new Set(relevant.slice(0, 3).map((r) => r.chunk.id));
  for (const c of ws.concepts) if (c.chunkIds.some((id) => anchors.has(id))) matched.set(c.id, c);

  const selected = [...direct];
  const expanded: Concept[] = [];
  for (const concept of matched.values()) {
    for (const pre of prerequisitesOf(concept.id, ws.relations)) {
      const prerequisite = byId.get(pre);
      if (!prerequisite || matched.has(pre) || expanded.includes(prerequisite)) continue;
      expanded.push(prerequisite);
      const passage = ws.chunks.find((c) => c.id === prerequisite.chunkIds[0]);
      if (passage && !selected.includes(passage) && selected.length < limit) selected.push(passage);
    }
  }
  for (const r of ranked) {
    if (selected.length >= limit) break;
    if (!selected.includes(r.chunk) && r.score > 0.35) selected.push(r.chunk);
  }
  const concepts = [...matched.values(), ...expanded].slice(0, 12);
  return { passages: selected.slice(0, limit), concepts };
}

/** Evenly spread passages across the whole library, prioritising passages that anchor important concepts. */
export function coverage(ws: Workspace, count: number, focusIds: string[] = []): Chunk[] {
  const picked = new Map<string, Chunk>();
  const byId = new Map(ws.chunks.map((c) => [c.id, c]));
  for (const id of focusIds) {
    const c = byId.get(id);
    if (c && picked.size < count) picked.set(id, c);
  }
  const concepts = [...ws.concepts].sort((a, b) => b.importance - a.importance);
  for (const concept of concepts) {
    if (picked.size >= Math.ceil(count * 0.6)) break;
    const c = byId.get(concept.chunkIds[0]);
    if (c) picked.set(c.id, c);
  }
  const step = ws.chunks.length / Math.max(1, count - picked.size);
  for (let i = 0; picked.size < count && i < ws.chunks.length; i += Math.max(1, step)) {
    const c = ws.chunks[Math.floor(i)];
    picked.set(c.id, c);
  }
  const order = new Map(ws.chunks.map((c, i) => [c.id, i]));
  return [...picked.values()].sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}
