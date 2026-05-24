import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export const ollama = createOpenAICompatible({
  name: 'ollama',
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
  apiKey: process.env.OLLAMA_API_KEY || 'ollama',
});

export const model = ollama.chatModel(process.env.OLLAMA_MODEL);