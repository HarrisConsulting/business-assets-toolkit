export interface CopilotMessage {
  role?: string;
  content?:
    | string
    | { type?: string; text?: string }
    | Array<{ type?: string; text?: string }>;
}

export type ParsedIntentType =
  | 'ingest'
  | 'summarize'
  | 'query'
  | 'themes'
  | 'help';

export type SummaryLevel = 'sentence' | 'paragraph' | 'full';

export interface ParsedIntent {
  intent: ParsedIntentType;
  latestUserMessage: string;
  documentId?: string;
  rawText?: string;
  question?: string;
  level?: SummaryLevel;
}

const DOCUMENT_ID_REGEX =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

const toText = (content: CopilotMessage['content']): string => {
  if (!content) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(part => part.text ?? '')
      .filter(Boolean)
      .join('\n');
  }

  return content.text ?? '';
};

const detectIntent = (message: string): ParsedIntentType => {
  const text = message.toLowerCase();

  if (/\b(ingest|load|read|here is|process this)\b/.test(text)) {
    return 'ingest';
  }
  if (/\b(summarize|summary|tldr|tl;dr|overview)\b/.test(text)) {
    return 'summarize';
  }
  if (/\b(query|question|ask|what|how|why|find)\b/.test(text)) {
    return 'query';
  }
  if (/\b(themes|entities|topics|key points|extract)\b/.test(text)) {
    return 'themes';
  }

  return 'help';
};

const extractLevel = (message: string): SummaryLevel | undefined => {
  const match = message.toLowerCase().match(/\b(sentence|paragraph|full)\b/);
  if (!match) {
    return undefined;
  }

  if (match[1] === 'sentence') {
    return 'sentence';
  }
  if (match[1] === 'paragraph') {
    return 'paragraph';
  }
  return 'full';
};

const extractRawText = (message: string): string | undefined => {
  const cleaned = message.replace(
    /\b(ingest|load|read|here is|process this)\b\s*(this|document|doc)?\s*:?\s*/i,
    '',
  );

  const value = cleaned.trim();
  return value.length > 0 ? value : undefined;
};

const extractQuestion = (message: string): string | undefined => {
  const withoutDocId = message.replace(DOCUMENT_ID_REGEX, '').trim();
  const keywordIndex = withoutDocId.toLowerCase().indexOf('question');
  if (keywordIndex >= 0) {
    const remainder = withoutDocId.slice(keywordIndex + 'question'.length);
    const colonIndex = remainder.indexOf(':');
    if (colonIndex >= 0) {
      const explicitQuestion = remainder.slice(colonIndex + 1).trim();
      if (explicitQuestion) {
        return explicitQuestion;
      }
    }
  }

  const normalized = withoutDocId.replace(/\b(query|question|ask)\b\s*:?\s*/i, '');
  if (normalized.includes('?')) {
    return normalized.trim();
  }

  return normalized.trim().length > 0 ? normalized.trim() : undefined;
};

export const parseMessage = (messages: CopilotMessage[]): ParsedIntent => {
  const latestUserMessage =
    [...messages]
      .reverse()
      .find(message => message.role?.toLowerCase() === 'user')
      ?.content ?? '';

  const text = toText(latestUserMessage).trim();
  const intent = detectIntent(text);
  const documentId = text.match(DOCUMENT_ID_REGEX)?.[0];
  const level = extractLevel(text);

  const parsed: ParsedIntent = {
    intent,
    latestUserMessage: text,
    documentId,
    level,
  };

  if (intent === 'ingest') {
    parsed.rawText = extractRawText(text);
  }

  if (intent === 'query') {
    parsed.question = extractQuestion(text);
  }

  return parsed;
};
