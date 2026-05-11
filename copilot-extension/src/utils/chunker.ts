import { get_encoding } from 'tiktoken';

export interface Chunk {
  index: number;
  text: string;
  tokenCount: number;
}

export interface ChunkingResult {
  chunks: Chunk[];
  totalTokens: number;
}

export const DEFAULT_MAX_TOKENS = 1500;

const encoding = get_encoding('cl100k_base');

export const countTokens = (text: string): number => encoding.encode(text).length;

const splitLongSegment = (segment: string, maxTokens: number): string[] => {
  const words = segment.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (countTokens(candidate) <= maxTokens) {
      current = candidate;
      continue;
    }

    if (current) {
      parts.push(current);
    }
    current = word;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
};

const toSemanticSegments = (text: string): string[] => {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [];
  }

  const segments: string[] = [];

  for (const paragraph of paragraphs) {
    const sentences = paragraph
      .split(/(?<=[.!?])\s+/)
      .map(part => part.trim())
      .filter(Boolean);

    if (sentences.length > 1) {
      segments.push(...sentences);
    } else {
      segments.push(paragraph);
    }
  }

  return segments;
};

export const chunkText = (
  text: string,
  maxTokens = DEFAULT_MAX_TOKENS,
): ChunkingResult => {
  const safeText = text.trim();
  if (!safeText) {
    return { chunks: [], totalTokens: 0 };
  }

  const segments = toSemanticSegments(safeText);
  const chunks: Chunk[] = [];
  let current = '';
  let currentTokens = 0;

  const flushCurrent = (): void => {
    if (!current) {
      return;
    }
    chunks.push({
      index: chunks.length,
      text: current,
      tokenCount: currentTokens,
    });
    current = '';
    currentTokens = 0;
  };

  for (const segment of segments) {
    const segmentTokens = countTokens(segment);

    if (segmentTokens > maxTokens) {
      flushCurrent();
      const parts = splitLongSegment(segment, maxTokens);
      for (const part of parts) {
        const partTokens = countTokens(part);
        chunks.push({
          index: chunks.length,
          text: part,
          tokenCount: partTokens,
        });
      }
      continue;
    }

    const candidate = current ? `${current}\n${segment}` : segment;
    const candidateTokens = countTokens(candidate);

    if (candidateTokens <= maxTokens) {
      current = candidate;
      currentTokens = candidateTokens;
      continue;
    }

    flushCurrent();
    current = segment;
    currentTokens = segmentTokens;
  }

  flushCurrent();

  return {
    chunks,
    totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
  };
};
