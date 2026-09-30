import { sanitizeConcepts, sanitizePassages, summarize } from '@/lib/server/agents';
import { errorResponse, resolveProvider } from '@/lib/server/llm';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const p = resolveProvider(request);
    const body = await request.json();
    const passages = sanitizePassages(body.passages, 1600, 18);
    if (!passages.length) return Response.json({ error: 'passages required' }, { status: 400 });
    return Response.json(await summarize(p, passages, sanitizeConcepts(body.concepts)));
  } catch (error) {
    return errorResponse(error);
  }
}
