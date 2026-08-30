import { NextRequest } from 'next/server';
import { proxyJson } from '@/lib/api-server';
export async function POST(request: NextRequest) { return proxyJson('/node/details', await request.json()); }
