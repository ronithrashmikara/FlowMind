import { embed, errorResponse, resolveProvider } from '@/lib/server/llm';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const p = resolveProvider(request);
    const { texts } = await request.json();
    if (!Array.isArray(texts) || texts.length === 0) return Response.json({ error: 'texts must be a non-empty array' }, { status: 400 });
    const inputs = texts.slice(0, 48).map((text: unknown) => String(text ?? '').slice(0, 2400) || ' ');
    return Response.json({ vectors: await embed(p, inputs) });
  } catch (error) {
    return errorResponse(error);
  }
}
