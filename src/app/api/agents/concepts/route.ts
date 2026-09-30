import { extractConcepts } from '@/lib/server/agents';
import { errorResponse, resolveProvider } from '@/lib/server/llm';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const p = resolveProvider(request);
    const { passages } = await request.json();
    if (!Array.isArray(passages) || passages.length === 0) return Response.json({ error: 'passages required' }, { status: 400 });
    const clean = passages.slice(0, 18).map((p: { id?: unknown; locator?: unknown; text?: unknown }) => ({
      id: String(p.id ?? '').slice(0, 80),
      locator: String(p.locator ?? '').slice(0, 40),
      text: String(p.text ?? '').slice(0, 2200),
    }));
    return Response.json({ concepts: await extractConcepts(p, clean) });
  } catch (error) {
    return errorResponse(error);
  }
}
