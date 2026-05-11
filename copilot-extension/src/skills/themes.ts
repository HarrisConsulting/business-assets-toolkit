import { gpt } from '../utils/openai';
import { documentStore } from '../utils/store';
import type { SkillInput } from './ingest';

export const themes = async (input: SkillInput): Promise<string[]> => {
  const doc = input.documentId
    ? documentStore.get(input.documentId)
    : documentStore.getLatest();

  if (!doc) {
    return [
      'I could not find a document for theme extraction.',
      'Please ingest one first or provide a valid `document_id`.',
    ];
  }

  const context = doc.chunks
    .slice(0, 10)
    .map(chunk => `Chunk ${chunk.index + 1}:\n${chunk.text}`)
    .join('\n\n');

  const analysis = await gpt(
    'You are a structured analysis assistant.',
    `Analyze the following document chunks and respond in Markdown with these sections:
- Themes
- People
- Organizations
- Locations
- Concepts
- Main Argument
- Contradictions or Tensions

Use concise bullets and avoid speculation.

Document chunks:
${context}`,
  );

  return [analysis];
};
