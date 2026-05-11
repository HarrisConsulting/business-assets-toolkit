import { v4 as uuidv4 } from 'uuid';
import { chunkText, DEFAULT_MAX_TOKENS } from '../utils/chunker';
import { documentStore } from '../utils/store';

export interface SkillInput {
  documentId?: string;
  rawText?: string;
  question?: string;
  level?: 'sentence' | 'paragraph' | 'full';
}

const inferTitle = (text: string): string => {
  const firstLine = text.split('\n')[0]?.trim();
  if (!firstLine) {
    return 'Untitled Document';
  }
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
};

export const ingest = async (input: SkillInput): Promise<string[]> => {
  const rawText = input.rawText?.trim();

  if (!rawText) {
    return [
      'Please provide the document text to ingest.',
      'Example: `@doc-analyst ingest this: <paste your document>`',
    ];
  }

  const { chunks, totalTokens } = chunkText(rawText, DEFAULT_MAX_TOKENS);
  if (chunks.length === 0) {
    return ['No readable content was found. Please provide non-empty text.'];
  }

  const id = uuidv4();
  documentStore.set(id, {
    id,
    title: inferTitle(rawText),
    chunks,
    createdAt: new Date().toISOString(),
    totalTokens,
  });

  return [
    '✅ Document ingested successfully.',
    `- **document_id:** \`${id}\``,
    `- **chunks:** ${chunks.length}`,
    `- **total_tokens:** ${totalTokens}`,
    '',
    `Next step examples:`,
    `- \`@doc-analyst summarize doc ${id}\``,
    `- \`@doc-analyst what are the key points? doc ${id}\``,
  ];
};
