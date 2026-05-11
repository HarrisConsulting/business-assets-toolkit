import { gpt } from '../utils/openai';
import { documentStore } from '../utils/store';
import type { SkillInput } from './ingest';

const resolveSummaryInstruction = (level: SkillInput['level']): string => {
  if (level === 'sentence') {
    return 'Write exactly one sentence.';
  }
  if (level === 'paragraph') {
    return 'Write a single concise paragraph.';
  }
  return 'Write a comprehensive multi-paragraph summary with key takeaways.';
};

export const summarize = async (input: SkillInput): Promise<string[]> => {
  const doc = input.documentId
    ? documentStore.get(input.documentId)
    : documentStore.getLatest();

  if (!doc) {
    return [
      'I could not find a document to summarize.',
      'Please ingest one first or provide a valid `document_id`.',
    ];
  }

  const sectionSummaries = await Promise.all(
    doc.chunks.map(chunk =>
      gpt(
        'You are a precise technical summarizer.',
        `Summarize this section in 2-3 sentences while preserving factual details.\n\nSection ${
          chunk.index + 1
        }:\n${chunk.text}`,
      ),
    ),
  );

  const synthesized = await gpt(
    'You are a document synthesis assistant.',
    `Create a ${input.level ?? 'full'}-level summary from these section summaries.\n${
      resolveSummaryInstruction(input.level)
    }\n\n${sectionSummaries
      .map((summary, index) => `Section ${index + 1}: ${summary}`)
      .join('\n\n')}`,
  );

  return [
    `## Summary (${input.level ?? 'full'})`,
    synthesized,
    '',
    '## Section Summaries',
    ...sectionSummaries.map(
      (summary, index) => `- **Section ${index + 1}:** ${summary}`,
    ),
  ];
};
