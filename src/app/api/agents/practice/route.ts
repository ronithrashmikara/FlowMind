import { practice, sanitizeConcepts, sanitizePassages, verifyQuiz } from '@/lib/server/agents';
import { errorResponse, resolveProvider } from '@/lib/server/llm';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const p = resolveProvider(request);
    const body = await request.json();
    const passages = sanitizePassages(body.passages, 1600, 14);
    if (!passages.length) return Response.json({ error: 'passages required' }, { status: 400 });
    const focus = typeof body.focus === 'string' ? body.focus.slice(0, 80) : undefined;
    const set = await practice(p, passages, sanitizeConcepts(body.concepts, 30), focus);
    const verified = await verifyQuiz(p, passages, set.questions).catch(() => null);
    return Response.json({ ...set, questions: verified?.questions ?? set.questions, verification: verified ? { fixed: verified.fixed, dropped: verified.dropped } : null });
  } catch (error) {
    return errorResponse(error);
  }
}
