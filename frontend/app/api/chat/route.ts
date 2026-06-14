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
import { readFileSync, existsSync, mkdirSync, appendFileSync, statSync } from 'fs';
import { dirname, join } from 'path';

export type ChatTools = InferUITools<typeof searchTools>;

export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;

const CHAT_LOG_CSV = '/app/data/chat_logs.csv';

function escapeCSV(value: string): string {
  return value
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/"/g, '""');
}

function appendChatLog(payload: {
  timestamp: string;
  user_msg: string;
  bot_msg: string;
  model: string;
  response_time: number;
}) {
  try {
    const dir = dirname(CHAT_LOG_CSV);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const needsHeader = !existsSync(CHAT_LOG_CSV) || statSync(CHAT_LOG_CSV).size === 0;

    if (needsHeader) {
      const header = ['timestamp', 'user_msg', 'bot_msg', 'model', 'response_time'].join(',');
      appendFileSync(CHAT_LOG_CSV, '\u00EF\u00BB\u00BF' + header + '\n', { encoding: 'utf-8' });
    }

    const row = [
      payload.timestamp,
      `"${escapeCSV(payload.user_msg)}"`,
      `"${escapeCSV(payload.bot_msg)}"`,
      payload.model,
      payload.response_time.toFixed(3),
    ].join(',');

    appendFileSync(CHAT_LOG_CSV, row + '\n', { encoding: 'utf-8' });
  } catch (err) {
    console.error('Failed to write chat log:', err);
  }
}

export async function POST(req: Request) {
  const { messages }: { messages: ChatMessage[] } = await req.json();
  const systemPrompt = readFileSync(join(process.cwd(), 'system-prompt.txt'), 'utf-8');

  const maxSteps = parseInt(process.env.MAX_AGENT_STEPS || '20', 10);

  const startTime = Date.now();

  const lastUserMessage = messages
    .slice()
    .reverse()
    .find(m => m.role === 'user');
  const userMsgText =
    lastUserMessage?.parts
      ?.filter(p => p.type === 'text')
      .map(p => (p as { text: string }).text)
      .join('') || '';

  const result = streamText({
    model: model,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(maxSteps),
    tools: searchTools,
    onFinish: event => {
      const responseTime = (Date.now() - startTime) / 1000;
      appendChatLog({
        timestamp: new Date().toISOString(),
        user_msg: userMsgText,
        bot_msg: event.text,
        model: process.env.OLLAMA_MODEL || 'unknown',
        response_time: responseTime,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}