import { serverProvider } from '@/lib/server/llm';

export const dynamic = 'force-dynamic';

export function GET() {
  const provider = serverProvider();
  return Response.json({
    serverKey: Boolean(provider),
    provider: provider?.name ?? null,
    model: provider?.chatModel ?? null,
    embedModel: provider?.embedModel ?? null,
  });
}
