import Anthropic from '@anthropic-ai/sdk';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompactionResult {
  messages: ChatMessage[];
  wasCompacted: boolean;
  originalCount: number;
}

const VERBATIM_RECENT_COUNT = 20;
const DEFAULT_COMPACTION_THRESHOLD = 180;

/**
 * Build a prompt for summarizing conversation history
 */
function buildSummaryPrompt(messages: ChatMessage[]): string {
  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  return `Summarize this conversation history in a concise way that preserves all important context, topics discussed, decisions made, and any specific details the user mentioned about themselves or their situation. The summary will be used as context for continuing the conversation.

<conversation>
${conversationText}
</conversation>

Provide a summary in 2-4 paragraphs. Focus on:
- Key topics and questions discussed
- Important facts or preferences the user shared
- Any decisions or conclusions reached
- Context needed to continue the conversation naturally`;
}

/**
 * Generate a summary of older messages using Haiku
 */
async function generateSummary(
  messages: ChatMessage[],
  client: Anthropic
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: buildSummaryPrompt(messages),
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from summarization');
  }

  return textBlock.text;
}

/**
 * Compact a conversation when it exceeds the threshold
 *
 * When messages.length >= threshold:
 * 1. Split: older = messages[0:-20], recent = messages[-20:]
 * 2. Summarize `older` using Haiku
 * 3. Return: [summaryMessage, ...recent] (21 messages)
 *
 * On error, falls back to keeping last 100 messages
 */
export async function compactConversation(
  messages: ChatMessage[],
  client: Anthropic,
  threshold: number = DEFAULT_COMPACTION_THRESHOLD
): Promise<CompactionResult> {
  const originalCount = messages.length;

  // Below threshold: return unchanged
  if (messages.length < threshold) {
    return {
      messages,
      wasCompacted: false,
      originalCount,
    };
  }

  try {
    // Split messages
    const olderMessages = messages.slice(0, -VERBATIM_RECENT_COUNT);
    const recentMessages = messages.slice(-VERBATIM_RECENT_COUNT);

    // Generate summary of older messages
    const summary = await generateSummary(olderMessages, client);

    // Create summary message as assistant context
    const summaryMessage: ChatMessage = {
      role: 'assistant',
      content: `[Previous conversation summary]\n\n${summary}\n\n[End of summary - conversation continues below]`,
    };

    return {
      messages: [summaryMessage, ...recentMessages],
      wasCompacted: true,
      originalCount,
    };
  } catch (error) {
    console.warn('[chat-compaction] Summarization failed, falling back to truncation:', error);

    // Fallback: keep last 100 messages
    const fallbackMessages = messages.slice(-100);

    return {
      messages: fallbackMessages,
      wasCompacted: true,
      originalCount,
    };
  }
}

// Export for testing
export { buildSummaryPrompt, generateSummary };
