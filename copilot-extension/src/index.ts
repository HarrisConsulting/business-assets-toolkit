import * as copilotSdk from '@copilot-extensions/preview-sdk';
import dotenv from 'dotenv';
import express from 'express';
import { handleAgentMessages } from './handlers/agentHandler';
import type { CopilotMessage } from './utils/parser';

dotenv.config();

const sdk = copilotSdk as {
  createTextEvent?: (text: string) => unknown;
  createDoneEvent?: () => unknown;
};

const app = express();
app.use(express.json({ limit: '10mb' }));

const writeSse = (res: express.Response, payload: unknown): void => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const createTextPayload = (text: string): unknown => {
  if (sdk.createTextEvent) {
    return sdk.createTextEvent(text);
  }
  return { type: 'text', text };
};

const createDonePayload = (): unknown => {
  if (sdk.createDoneEvent) {
    return sdk.createDoneEvent();
  }
  return { type: 'done' };
};

const extractMessages = (body: unknown): CopilotMessage[] => {
  if (typeof body !== 'object' || body === null) {
    return [];
  }

  const record = body as Record<string, unknown>;

  if (Array.isArray(record.messages)) {
    return record.messages as CopilotMessage[];
  }

  if (
    typeof record.prompt === 'object' &&
    record.prompt !== null &&
    Array.isArray((record.prompt as Record<string, unknown>).messages)
  ) {
    return (record.prompt as { messages: CopilotMessage[] }).messages;
  }

  return [];
};

app.get('/', (_req, res) => {
  res.json({ status: 'ok', extension: 'doc-analyst' });
});

app.post('/', async (req, res) => {
  const githubToken = req.header('X-GitHub-Token');
  if (!githubToken) {
    res.status(401).json({ error: 'Missing X-GitHub-Token header' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const messages = extractMessages(req.body);

    for await (const text of handleAgentMessages(messages, { githubToken })) {
      writeSse(res, createTextPayload(text));
    }
  } catch (error) {
    const message =
      error instanceof Error && process.env.NODE_ENV !== 'production'
        ? error.message
        : 'Unable to process this request right now.';
    writeSse(res, createTextPayload(`Error: ${message}`));
  } finally {
    writeSse(res, createDonePayload());
    res.end();
  }
});

const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, () => {
  console.log(`doc-analyst extension listening on port ${port}`);
});

server.on('error', error => {
  console.error('Failed to start doc-analyst extension server', error);
  process.exitCode = 1;
});
