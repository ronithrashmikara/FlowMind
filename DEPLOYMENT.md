# Deployment

## Modal API

The API is currently deployed at:

`https://ronithrashmikara--flowmind-api-fastapi-app.modal.run`

Health check: `https://ronithrashmikara--flowmind-api-fastapi-app.modal.run/health`

```bash
python -m pip install modal
modal setup
modal secret create flowmind-secrets MISTRAL_API_KEY=... CORS_ORIGINS=https://your-web-domain
modal deploy services/api/modal_app.py
```

Modal prints the stable ASGI URL. Verify it with `GET /health`. Uploaded source indexes are stored on the `flowmind-data` Volume rather than an ephemeral container disk.

## Vercel web

Create one Vercel project from this repository:

- Root Directory: `apps/web`
- Framework: Next.js
- Environment variable: `API_URL=<Modal ASGI URL>`

For the current deployment, set:

`API_URL=https://ronithrashmikara--flowmind-api-fastapi-app.modal.run`

The browser calls same-origin `/api/*` routes; only the server-side BFF talks to Modal, avoiding CORS and keeping deployment details private.

## Docker host

Set `MISTRAL_API_KEY` in the host secret manager, then run:

```bash
docker compose up -d --build
```

Back up the `flowmind-data` volume. Add authentication before exposing a shared or paid production instance.
