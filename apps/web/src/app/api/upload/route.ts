import { NextRequest } from 'next/server';
import { proxyForm } from '@/lib/api-server';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) { return proxyForm('/upload', await request.formData()); }
