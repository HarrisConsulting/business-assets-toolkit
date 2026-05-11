import { ingest } from '../skills/ingest';
import type { SkillInput } from '../skills/ingest';
import { query } from '../skills/query';
import { summarize } from '../skills/summarize';
import { themes } from '../skills/themes';
import { parseMessage } from '../utils/parser';
import type { CopilotMessage } from '../utils/parser';

const helpMessage = (): string[] => [
  'I can help with long-document analysis. Try one of these:',
  '- `@doc-analyst ingest this: <paste long document>`',
  '- `@doc-analyst summarize doc <document_id>`',
  '- `@doc-analyst what does this doc say about X? doc <document_id>`',
  '- `@doc-analyst extract themes from doc <document_id>`',
];

const toSkillInput = (parsed: ReturnType<typeof parseMessage>): SkillInput => ({
  documentId: parsed.documentId,
  rawText: parsed.rawText,
  question: parsed.question,
  level: parsed.level,
});

export const handleAgentMessages = async function* (
  messages: CopilotMessage[],
): AsyncGenerator<string> {
  const parsed = parseMessage(messages);
  const input = toSkillInput(parsed);

  if (parsed.intent === 'ingest') {
    for (const line of await ingest(input)) {
      yield line;
    }
    return;
  }

  if (parsed.intent === 'summarize') {
    for (const line of await summarize(input)) {
      yield line;
    }
    return;
  }

  if (parsed.intent === 'query') {
    for (const line of await query(input)) {
      yield line;
    }
    return;
  }

  if (parsed.intent === 'themes') {
    for (const line of await themes(input)) {
      yield line;
    }
    return;
  }

  for (const line of helpMessage()) {
    yield line;
  }
};
