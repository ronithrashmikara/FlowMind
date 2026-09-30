import { mapRelations, sanitizeConcepts } from '@/lib/server/agents';
import { errorResponse, resolveProvider } from '@/lib/server/llm';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const p = resolveProvider(request);
    const { concepts } = await request.json();
    const clean = sanitizeConcepts(concepts, 60);
    if (clean.length < 2) return Response.json({ title: '', overview: '', relations: [] });
    return Response.json(await mapRelations(p, clean));
  } catch (error) {
    return errorResponse(error);
  }
}
