import { ILLMResponse } from './types';

export interface IParseResult {
  response: ILLMResponse | null;
  warning: { code: string; message: string; rawContent: string } | null;
}

export function parseRawContent(rawContent: string): IParseResult {
  // Strip markdown code blocks if present
  let content = rawContent.trim();
  if (content.startsWith('```json')) {
    content = content.slice(7);
  } else if (content.startsWith('```')) {
    content = content.slice(3);
  }
  if (content.endsWith('```')) {
    content = content.slice(0, -3);
  }
  content = content.trim();

  try {
    const parsed = JSON.parse(content);
    const response: ILLMResponse = {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : []
    };
    return { response, warning: null };
  } catch (error) {
    // Fallback: LLM sometimes mimics the "[Actions proposed]" format
    // that appears in its conversation history instead of outputting JSON.
    const fallback = parseActionsProposedFormat(content);
    if (fallback) {
      return { response: fallback, warning: null };
    }

    return {
      response: null,
      warning: {
        code: 'invalid_json',
        message: error instanceof Error ? error.message : 'JSON parse error',
        rawContent
      }
    };
  }
}

function parseActionsProposedFormat(content: string): ILLMResponse | null {
  const marker = '[Actions proposed]';
  const idx = content.indexOf(marker);
  if (idx === -1) {
    return null;
  }

  const messageText = content.slice(0, idx).trim();
  const actionsText = content.slice(idx + marker.length).trim();

  try {
    const actions = JSON.parse(actionsText);
    if (!Array.isArray(actions)) {
      return null;
    }
    return {
      messages: messageText
        ? [{ role: 'assistant' as const, content: messageText }]
        : [],
      actions
    };
  } catch {
    return null;
  }
}
