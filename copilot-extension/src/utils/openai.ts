import OpenAI from 'openai';

let client: OpenAI | null = null;

const getClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
};

export const gpt = async (system: string, user: string): Promise<string> => {
  const response = await getClient().chat.completions.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o',
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  if (typeof content === 'string') {
    return content.trim();
  }

  throw new Error('OpenAI response format is unsupported');
};
