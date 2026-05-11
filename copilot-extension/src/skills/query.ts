import { gpt } from '../utils/openai';
import { documentStore } from '../utils/store';
import type { SkillInput } from './ingest';

const MAX_CITATION_LENGTH = 240;

const tokenize = (value: string): Set<string> =>
  new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .map(token => token.trim())
      .filter(token => token.length > 2),
  );

const score = (chunk: string, questionTokens: Set<string>): number => {
  if (questionTokens.size === 0) {
    return 0;
  }

  const chunkTokens = tokenize(chunk);
  let overlap = 0;

  for (const token of questionTokens) {
    if (chunkTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / questionTokens.size;
};

export const query = async (input: SkillInput): Promise<string[]> => {
  const doc = input.documentId
    ? documentStore.get(input.documentId)
    : documentStore.getLatest();

  if (!doc) {
    return [
      'I could not find a document to query.',
      'Please ingest one first or provide a valid `document_id`.',
    ];
  }

  const question = input.question?.trim();
  if (!question) {
    return ['Please include a question, for example: `@doc-analyst ask: ...`'];
  }
  const questionTokens = tokenize(question);

  const topChunks = [...doc.chunks]
    .map(chunk => ({
      chunk,
      relevance: score(chunk.text, questionTokens),
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 3);

  const context = topChunks
    .map(
      ({ chunk }) =>
        `Chunk ${chunk.index + 1}:\n${chunk.text}\n--- end of chunk ${chunk.index + 1} ---`,
    )
    .join('\n\n');

  const answer = await gpt(
    'You answer using only provided context. If context is insufficient, say so explicitly. Always cite chunk numbers.',
    `Context:\n${context}\n\nQuestion: ${question}`,
  );

  return [
    `## Answer`,
    answer,
    '',
    '## Citations',
    ...topChunks.map(
      ({ chunk, relevance }) =>
        `- **Chunk ${chunk.index + 1}** (score: ${relevance.toFixed(
          2,
        )}): ${chunk.text.slice(0, MAX_CITATION_LENGTH)}${
          chunk.text.length > MAX_CITATION_LENGTH ? '…' : ''
        }`,
    ),
  ];
};
