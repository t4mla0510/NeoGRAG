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

export type ChatTools = InferUITools<typeof searchTools>;

export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;

const systemPrompt = process.env.SYSTEM_PROMPT_REBOT || `You are a helpful assistant`;

export async function POST(req: Request) {
  const { messages }: { messages: ChatMessage[] } = await req.json();

  const result = streamText({
    model: model,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(20),
    tools: searchTools,
  });

  return result.toUIMessageStreamResponse();
}