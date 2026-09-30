'use client';

import { newId } from './parse';
import type { AgentId, AgentStatus, Chunk, Concept, Relation, Workspace } from './types';

const KEY_STORAGE = 'flowmind.apiKey';

export function getUserKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setUserKey(value: string) {
  try {
    if (value) localStorage.setItem(KEY_STORAGE, value);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* storage unavailable */
  }
}

function headers(): HeadersInit {
  const key = getUserKey();
  return { 'Content-Type': 'application/json', ...(key ? { 'x-llm-key': key } : {}) };
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({ error: `Request failed (${response.status})` }));
  if (!response.ok || data?.error) throw new Error(data?.error || `Request failed (${response.status})`);
  return data as T;
}

/** Reads the tutor's NDJSON event stream, calling onEvent for each event. */
export async function stream(path: string, body: unknown, onEvent: (event: Record<string, unknown>) => void): Promise<void> {
  const response = await fetch(path, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
    if (done) break;
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer));
}

async function pool<T, R>(items: T[], size: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index], index);
      }
    }),
  );
  return results;
}

export const passagePayload = (chunks: Chunk[]) => chunks.map((c) => ({ filename: c.filename, locator: c.locator, text: c.text }));

const conceptKey = (name: string) => name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^\p{L}\p{N} ]/gu, '').replace(/s\b/g, '').trim();

type Report = (agent: AgentId, status: AgentStatus) => void;

/**
 * Ingestion swarm, orchestrated from the browser so each agent call stays short and the pipeline is visible:
 * embeddings index → Concept Extraction Agent (batched) → Relationship Mapping Agent over the whole library.
 */
export async function runIngestion(ws: Workspace, fresh: Chunk[], report: Report): Promise<Workspace> {
  // Index passages for semantic retrieval. Retrieval falls back to BM25 if this fails.
  report('embedding', { state: 'running', detail: `Embedding ${fresh.length} passages` });
  const embedBatches: Chunk[][] = [];
  for (let i = 0; i < fresh.length; i += 32) embedBatches.push(fresh.slice(i, i + 32));
  let embedded = 0;
  try {
    await pool(embedBatches, 1, async (batch) => {
      const request = () => post<{ vectors: number[][] }>('/api/embed', { texts: batch.map((c) => c.text) });
      // Free-tier endpoints rate-limit bursts; one patient retry usually succeeds.
      const { vectors } = await request().catch((error: Error) => {
        if (/daily/i.test(error.message)) throw error;
        return new Promise((resolve) => setTimeout(resolve, 4000)).then(request);
      });
      batch.forEach((c, i) => (c.embedding = vectors[i]));
      embedded += batch.length;
      report('embedding', { state: 'running', detail: `${embedded}/${fresh.length} passages indexed` });
    });
    report('embedding', { state: 'done', detail: `${fresh.length} passages · semantic index` });
  } catch (error) {
    report('embedding', { state: 'error', detail: `Keyword + graph retrieval only — ${/daily/i.test((error as Error).message) ? 'embedding quota used up' : (error as Error).message}` });
  }

  // Concept extraction over batches of ~6.5k characters (at most 12 batches, spread across the document).
  report('concepts', { state: 'running', detail: 'Reading passages' });
  let batches: Chunk[][] = [];
  let current: Chunk[] = [];
  let size = 0;
  for (const chunk of fresh) {
    if (current.length && (size + chunk.text.length > 6500 || current.length >= 7)) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(chunk);
    size += chunk.text.length;
  }
  if (current.length) batches.push(current);
  if (batches.length > 12) batches = Array.from({ length: 12 }, (_, i) => batches[Math.floor((i * batches.length) / 12)]);

  const concepts = new Map(ws.concepts.map((c) => [conceptKey(c.name), { ...c, chunkIds: [...c.chunkIds] }]));
  let finished = 0;
  let failures = 0;
  await pool(batches, 2, async (batch) => {
    const alias = new Map(batch.map((c, i) => [`p${i + 1}`, c.id]));
    try {
      const { concepts: found } = await post<{ concepts: { name: string; definition: string; kind: Concept['kind']; importance: number; passage_ids: string[] }[] }>(
        '/api/agents/concepts',
        { passages: batch.map((c, i) => ({ id: `p${i + 1}`, locator: `${c.filename} ${c.locator}`, text: c.text })) },
      );
      for (const item of found) {
        const key = conceptKey(item.name);
        if (!key) continue;
        const ids = item.passage_ids.map((id) => alias.get(id)).filter(Boolean) as string[];
        if (!ids.length) ids.push(batch[0].id);
        const existing = concepts.get(key);
        if (existing) {
          existing.importance = Math.max(existing.importance, item.importance);
          existing.chunkIds = [...new Set([...existing.chunkIds, ...ids])].slice(0, 8);
          if (item.definition.length > existing.definition.length && existing.definition.length < 120) existing.definition = item.definition;
        } else {
          concepts.set(key, { id: newId('cpt'), name: item.name, definition: item.definition, kind: item.kind, importance: item.importance, chunkIds: ids });
        }
      }
    } catch (error) {
      failures++;
      if (failures === batches.length) throw error;
    }
    finished++;
    report('concepts', { state: 'running', detail: `Batch ${finished}/${batches.length} · ${concepts.size} concepts` });
  });
  const ranked = [...concepts.values()].sort((a, b) => b.importance - a.importance || b.chunkIds.length - a.chunkIds.length).slice(0, 48);
  report('concepts', { state: 'done', detail: `${ranked.length} concepts from ${batches.length} batch${batches.length > 1 ? 'es' : ''}` });

  // Relationship mapping across the whole library so links can cross sources.
  report('relations', { state: 'running', detail: `Linking ${ranked.length} concepts` });
  const mapped = await post<{ title: string; overview: string; relations: { source: string; target: string; type: Relation['type']; label?: string }[] }>(
    '/api/agents/relations',
    { concepts: ranked.map((c) => ({ name: c.name, definition: c.definition, kind: c.kind })) },
  );
  const byName = new Map(ranked.map((c) => [conceptKey(c.name), c.id]));
  const seen = new Set<string>();
  const relations: Relation[] = [];
  for (const r of mapped.relations) {
    const source = byName.get(conceptKey(r.source));
    const target = byName.get(conceptKey(r.target));
    const id = `${source}->${target}`;
    if (!source || !target || source === target || seen.has(id) || seen.has(`${target}->${source}`)) continue;
    seen.add(id);
    relations.push({ id: newId('rel'), source, target, type: r.type, label: r.label });
  }
  report('relations', { state: 'done', detail: `${relations.length} links · ${ranked.length} nodes` });

  return {
    ...ws,
    title: mapped.title || ws.title,
    overview: mapped.overview || ws.overview,
    concepts: ranked,
    relations,
    summary: undefined,
    practice: undefined,
  };
}
