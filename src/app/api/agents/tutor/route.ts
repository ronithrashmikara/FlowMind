import { critique, sanitizeConcepts, sanitizePassages, teach, type TutorDraft, type TutorInput, type TutorMode } from '@/lib/server/agents';
import { errorResponse, resolveProvider, type Provider } from '@/lib/server/llm';
import type { CriticReport } from '@/lib/types';

export const maxDuration = 60;

const MAX_ATTEMPTS = 3;

/**
 * Pedagogy swarm: Teaching Agent drafts, Critic Agent validates; a rejected draft is revised
 * with the critic's feedback before the learner sees anything. Progress streams as NDJSON events.
 */
export async function POST(request: Request) {
  let p: Provider;
  let input: TutorInput;
  try {
    p = resolveProvider(request);
    const body = await request.json();
    const question = String(body.question ?? '').trim().slice(0, 1200);
    if (!question) return Response.json({ error: 'question required' }, { status: 400 });
    const modes: TutorMode[] = ['explain', 'socratic', 'simplify'];
    input = {
      question,
      mode: modes.includes(body.mode) ? body.mode : 'explain',
      language: String(body.language || 'English').slice(0, 40),
      history: Array.isArray(body.history) ? body.history.slice(-6).map((m: { role?: string; content?: unknown }) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '').slice(0, 1200) })) : [],
      passages: sanitizePassages(body.passages, 1800, 10),
      concepts: sanitizeConcepts(body.concepts, 14),
      struggling: Array.isArray(body.struggling) ? body.struggling.slice(0, 6).map(String) : [],
    };
    if (!input.passages.length) return Response.json({ error: 'Add a source before asking the tutor.' }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      const reports: CriticReport[] = [];
      let best: { draft: TutorDraft; report: CriticReport } | undefined;
      try {
        send({ type: 'context', passages: input.passages.length, concepts: input.concepts.length });
        let feedback: CriticReport | undefined;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          send({ type: 'stage', agent: 'teaching', attempt });
          const draft = await teach(p, input, feedback);
          send({ type: 'stage', agent: 'critic', attempt });
          const report = await critique(p, input, draft, attempt);
          reports.push(report);
          send({ type: 'critic', report });
          if (!best || report.score > best.report.score) best = { draft, report };
          if (report.verdict === 'pass') break;
          feedback = report;
        }
        const final = best!;
        send({ type: 'final', result: { ...final.draft, verified: final.report.verdict === 'pass', attempts: reports.length, critic: reports } });
      } catch (error) {
        send({ type: 'error', error: error instanceof Error ? error.message : 'Tutor failed' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
