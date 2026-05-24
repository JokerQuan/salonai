import { Injectable } from '@nestjs/common';
import { ModelProviderKind } from '@prisma/client';
import type { ChatMessage } from '@salonai/shared';
import {
  ModelProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
  ProviderRequestError,
} from './model-provider.types';

type OpenAiCompatibleResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

@Injectable()
export class OpenAiCompatibleProvider implements ModelProvider {
  readonly kind = ModelProviderKind.OPENAI_COMPATIBLE;

  async generate(
    input: ProviderGenerateInput,
  ): Promise<ProviderGenerateResult> {
    const baseUrl =
      input.config.baseUrl ?? process.env.OPENAI_COMPATIBLE_BASE_URL;
    const model = input.config.model || process.env.OPENAI_COMPATIBLE_MODEL;
    const apiKeyEnvName =
      input.config.apiKeyEnvName ?? 'OPENAI_COMPATIBLE_API_KEY';
    const apiKey = process.env[apiKeyEnvName];

    if (!baseUrl) {
      throw new ProviderRequestError(
        'Missing OpenAI-compatible base URL',
        'missing_base_url',
      );
    }

    if (!model) {
      throw new ProviderRequestError(
        'Missing OpenAI-compatible model',
        'missing_model',
      );
    }

    if (!apiKey) {
      throw new ProviderRequestError(
        `Missing API key env ${apiKeyEnvName}`,
        'missing_api_key',
      );
    }

    const response = await fetch(
      `${baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: input.messages,
          temperature: input.temperature,
          max_tokens: input.maxOutputTokens,
          stream: false,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new ProviderRequestError(
        `OpenAI-compatible provider failed with ${response.status}: ${errorText}`,
        'provider_http_error',
      );
    }

    const body = (await response.json()) as OpenAiCompatibleResponse;
    const outputText = body.choices?.[0]?.message?.content ?? '';
    const inputTokens =
      body.usage?.prompt_tokens ?? estimateChatInputTokens(input.messages);
    const outputTokens =
      body.usage?.completion_tokens ?? estimateTextTokens(outputText);
    const totalTokens = body.usage?.total_tokens ?? inputTokens + outputTokens;

    return {
      outputText,
      usage: { inputTokens, outputTokens, totalTokens },
      raw: body,
    };
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
