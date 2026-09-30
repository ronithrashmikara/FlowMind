# Deployment

FlowMind is a single Next.js app: the UI, the agent API routes and the sample lecture all deploy together.
There is no separate backend, database or volume. Documents are parsed in the visitor's browser and the
workspace is stored in their browser (IndexedDB); the server only proxies model calls.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` or `MISTRAL_API_KEY` | one of them | Server-side model key. Never use a `NEXT_PUBLIC_*` name. |
| `LLM_PROVIDER` | no | `openrouter` or `mistral` when both keys are set |
| `OPENROUTER_MODEL` | no | Chat model, default `stealth/space-bunny-alpha` |
| `OPENROUTER_EMBED_MODEL` | no | Embeddings, default `nvidia/nemotron-3-embed-1b:free` (`none` = keyword + graph retrieval only) |
| `OPENROUTER_REASONING` | no | Reasoning effort for reasoning models, default `low` |
| `MISTRAL_MODEL` | no | Default `mistral-small-latest` (embeddings use `mistral-embed`) |

Visitors can also paste their own OpenRouter (`sk-or-…`) or Mistral key in **Settings**; it stays in their
browser and is sent only to this site's API routes. The site keeps working that way after a server key is revoked.

## Vercel (recommended)

1. Import `ronithrashmikara/FlowMind` in Vercel. Framework: Next.js. Root directory: the repository root.
2. Add `OPENROUTER_API_KEY` (or `MISTRAL_API_KEY`) under Settings → Environment Variables.
3. Deploy. `vercel.json` gives the agent routes up to 60 s, which covers a Teaching Agent draft, a Critic
   check and one revision.

From the CLI:

```bash
npx vercel link
npx vercel env add OPENROUTER_API_KEY production
npx vercel deploy --prod
```

## Docker / any Node host

```bash
docker build -t flowmind .
docker run -p 3000:3000 -e OPENROUTER_API_KEY=sk-or-... flowmind
```

Or without Docker: `npm ci && npm run build && npm start`.

## Legacy Modal API

Earlier versions used a Python API on Modal (`ronithrashmikara--flowmind-api-fastapi-app.modal.run`).
The single-site app no longer calls it; it can be stopped with `modal app stop flowmind-api`.
Add authentication or rate limiting before exposing a server key on a high-traffic public deployment.
