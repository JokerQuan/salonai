import type { ModelProviderKind } from '@prisma/client';
import type { ChatMessage, TokenUsage } from '@salonai/shared';

export type ProviderModelConfig = {
  id: string;
  providerKind: ModelProviderKind;
  model: string;
  baseUrl: string | null;
  apiKeyEnvName: string | null;
};

export type ProviderGenerateInput = {
  config: ProviderModelConfig;
  messages: ChatMessage[];
  temperature: number;
  maxOutputTokens: number;
};

export type ProviderGenerateResult = {
  outputText: string;
  usage: TokenUsage;
  raw: unknown;
};

export interface ModelProvider {
  readonly kind: ModelProviderKind;
  generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult>;
}

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}
