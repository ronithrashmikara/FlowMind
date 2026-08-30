const API_URL = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export async function proxyJson(path: string, body: unknown): Promise<Response> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' } });
}

export async function proxyForm(path: string, form: FormData): Promise<Response> {
  const response = await fetch(`${API_URL}${path}`, { method: 'POST', body: form, cache: 'no-store' });
  return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' } });
}
