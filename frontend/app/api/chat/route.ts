import {
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
  streamText,
} from 'ai';
import { model } from '@/providers/ollama';
import { searchTools } from '@/tools/search-tools';
import { readFileSync } from 'fs';
import { join } from 'path';

export type ChatTools = InferUITools<typeof searchTools>;

export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;

export async function POST(req: Request) {
  const { messages }: { messages: ChatMessage[] } = await req.json();
  const systemPrompt = readFileSync(join(process.cwd(), 'system-prompt.txt'), 'utf-8');

  const maxSteps = parseInt(process.env.MAX_AGENT_STEPS || '20', 10);

  const result = streamText({
    model: model,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(maxSteps),
    tools: searchTools,
  });

  return result.toUIMessageStreamResponse();
}