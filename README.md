# FlowMind

FlowMind is the single home for the former **flow-mind** frontend and **PathTree** backend. Both Git histories are preserved in this repository, while the product now ships as one monorepo.

## Why the merge matters

The old frontend sent only the first few thousand characters of one document to an LLM. The old backend kept documents in process memory. This merged version instead creates a persistent **workspace**, lets users add several PDF, PPTX, DOCX, Markdown, or text sources, retrieves the most relevant passages for each request, and returns inspectable citations with tutor answers.

## Layout

```text
apps/web/       Next.js product and same-origin BFF routes
services/api/   FastAPI ingestion, retrieval, generation, and Modal entrypoint
docs/legacy/    historical PathTree documentation
```

## Local development

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3000`. Data survives container restarts in the `flowmind-data` volume. The API health endpoint is `http://localhost:8000/health`.

Without Docker:

```bash
python -m venv .venv
.venv/Scripts/pip install -r services/api/requirements.txt
npm install
npm run dev:api
npm run dev:web
```

## Production

The repository supports two practical deployment shapes:

1. **One Docker deployment** using `docker-compose.yml` on Railway, Render, Fly.io, or a VM.
2. **Vercel + Modal from the same monorepo**: deploy `services/api/modal_app.py`, set `API_URL` in Vercel to the resulting Modal URL, and use `apps/web` as the Vercel root directory. The named Modal Volume persists source indexes.

Required secret: `MISTRAL_API_KEY`. Never place provider keys in source code or `NEXT_PUBLIC_*` variables.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for exact commands and operational notes.
