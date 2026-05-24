import { Injectable } from '@nestjs/common';
import { ModelProviderKind } from '@prisma/client';
import { MockModelProvider } from './mock-model.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import type { ModelProvider } from './model-provider.types';

@Injectable()
export class ModelProviderService {
  private readonly providers: Map<ModelProviderKind, ModelProvider>;

  constructor(
    mockProvider: MockModelProvider,
    openAiCompatibleProvider: OpenAiCompatibleProvider,
  ) {
    this.providers = new Map<ModelProviderKind, ModelProvider>([
      [mockProvider.kind, mockProvider],
      [openAiCompatibleProvider.kind, openAiCompatibleProvider],
    ]);
  }

  getProvider(kind: ModelProviderKind): ModelProvider {
    const provider = this.providers.get(kind);

    if (!provider) {
      throw new Error(`No model provider registered for ${kind}`);
    }

    return provider;
  }
}
