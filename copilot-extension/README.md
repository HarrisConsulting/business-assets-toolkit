# doc-analyst — GitHub Copilot Extension

`doc-analyst` is a reusable GitHub Copilot Extension for long-document understanding. It can be used across any project — not tied to any specific application.

## What It Does

Invoke it in Copilot Chat with `@doc-analyst`:

| Command | What happens |
|---|---|
| `@doc-analyst ingest this: <paste text>` | Chunks & stores the document, returns a `document_id` |
| `@doc-analyst summarize doc <id>` | Multi-level GPT-4o summary (sentence / paragraph / full) |
| `@doc-analyst what does it say about X? doc <id>` | Grounded Q&A with chunk citations |
| `@doc-analyst extract themes from doc <id>` | Themes, entities, main argument, contradictions |

## Register as a GitHub Copilot Extension

Follow GitHub's official guide:
https://docs.github.com/en/copilot/building-copilot-extensions

Set the GitHub App's Copilot Extension type to `agent` and point the callback URL to your deployed service.

## Local Development

```bash
cd copilot-extension
npm install
cp .env.example .env   # add your OPENAI_API_KEY
npm run dev
```

Health check:
```bash
curl http://localhost:3000/
# {"status":"ok","extension":"doc-analyst"}
```

## Build & Run

```bash
npm run build
npm run start
```

## Docker

```bash
npm run build
docker build -t doc-analyst .
docker run --rm -p 3000:3000 --env-file .env doc-analyst
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | Your OpenAI API key |
| `OPENAI_MODEL` | ❌ | Chat model to use (default: `gpt-4o`) |
| `NODE_ENV` | ❌ | Set to `production` to suppress detailed runtime error messages |
| `PORT` | ❌ | Server port (default: 3000) |

## Notes

- The document store is **in-memory only** and resets on service restart. For persistence, swap `src/utils/store.ts` with a Redis or database-backed implementation.
- All dependencies are scoped to `copilot-extension/` — this does not affect the root repository.
