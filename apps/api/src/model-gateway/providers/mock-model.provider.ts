import { Injectable } from '@nestjs/common';
import { ModelProviderKind } from '@prisma/client';
import type { ChatMessage } from '@salonai/shared';
import type {
  ModelProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
} from './model-provider.types';

@Injectable()
export class MockModelProvider implements ModelProvider {
  readonly kind = ModelProviderKind.MOCK;

  generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const lastUserMessage =
      [...input.messages].reverse().find((message) => message.role === 'user')
        ?.content ??
      input.messages.at(-1)?.content ??
      '';
    const outputText = `Mock response: ${lastUserMessage}`;
    const inputTokens = estimateChatInputTokens(input.messages);
    const outputTokens = estimateTextTokens(outputText);

    return Promise.resolve({
      outputText,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      raw: { provider: 'mock' },
    });
  }
}

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

function estimateChatInputTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => {
    return total + estimateTextTokens(`${message.role}: ${message.content}`);
  }, 0);
}
