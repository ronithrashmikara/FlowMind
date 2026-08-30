import { NextRequest } from 'next/server';
import { proxyJson } from '@/lib/api-server';
export async function POST(request: NextRequest) { return proxyJson('/generate/flashcards', await request.json()); }
