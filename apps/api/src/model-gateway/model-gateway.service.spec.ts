import { BadGatewayException } from '@nestjs/common';
import { ModelCallStatus, ModelProviderKind } from '@prisma/client';
import { ModelGatewayService } from './model-gateway.service';
import { ProviderRequestError } from './providers/model-provider.types';

describe('ModelGatewayService', () => {
  it('creates a default OpenAI-compatible config, calls provider, and records a successful model call', async () => {
    const modelConfig = {
      id: 'cfg_real',
      name: 'day1-openai-compatible',
      providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.example.test/v1',
      apiKeyEnvName: 'OPENAI_COMPATIBLE_API_KEY',
      inputTokenPriceUsdPer1K: { toNumber: () => 0.00015 },
      outputTokenPriceUsdPer1K: { toNumber: () => 0.0006 },
      enabled: true,
    };
    let createModelConfigArgs: { data: Record<string, unknown> } | undefined;
    let createModelCallArgs: { data: Record<string, unknown> } | undefined;
    const createModelConfig = (args: {
      data: Record<string, unknown>;
    }): Promise<typeof modelConfig> => {
      createModelConfigArgs = args;
      return Promise.resolve(modelConfig);
    };
    const createModelCall = (args: {
      data: Record<string, unknown>;
    }): Promise<{ id: string; createdAt: Date }> => {
      createModelCallArgs = args;
      return Promise.resolve({
        id: 'call_real',
        createdAt: new Date('2026-05-24T00:00:00.000Z'),
      });
    };
    const prisma = {
      modelConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: createModelConfig,
      },
      modelCall: {
        create: createModelCall,
      },
    };
    const provider = {
      generate: jest.fn().mockResolvedValue({
        outputText: '模型网关统一了模型调用入口。',
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        raw: { provider: 'openai-compatible' },
      }),
    };
    const modelProviderService = {
      getProvider: jest.fn().mockReturnValue(provider),
    };
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          OPENAI_COMPATIBLE_BASE_URL: 'https://api.example.test/v1',
          OPENAI_COMPATIBLE_MODEL: 'gpt-4o-mini',
        };
        return values[key];
      }),
    };
    const service = new ModelGatewayService(
      prisma as never,
      modelProviderService as never,
      configService as never,
    );

    const response = await service.complete({
      messages: [{ role: 'user', content: '介绍模型网关' }],
      temperature: 0.2,
      maxOutputTokens: 128,
      traceName: 'model-gateway.test',
    });

    expect(modelProviderService.getProvider).toHaveBeenCalledWith(
      ModelProviderKind.OPENAI_COMPATIBLE,
    );
    expect(createModelConfigArgs).toMatchObject({
      data: {
        name: 'day1-openai-compatible',
        providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
        model: 'gpt-4o-mini',
        baseUrl: 'https://api.example.test/v1',
        apiKeyEnvName: 'OPENAI_COMPATIBLE_API_KEY',
      },
    });
    expect(createModelCallArgs).toMatchObject({
      data: {
        status: ModelCallStatus.SUCCESS,
        modelConfigId: 'cfg_real',
        inputTokens: 10,
        outputTokens: 8,
        totalTokens: 18,
      },
    });
    expect(response.modelCallId).toBe('call_real');
    expect(response.providerKind).toBe(ModelProviderKind.OPENAI_COMPATIBLE);
    expect(response.outputText).toBe('模型网关统一了模型调用入口。');
  });

  it('records an error model call when the provider fails', async () => {
    const modelConfig = {
      id: 'cfg_openai',
      name: 'openai',
      providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.example.test/v1',
      apiKeyEnvName: 'OPENAI_COMPATIBLE_API_KEY',
      inputTokenPriceUsdPer1K: { toNumber: () => 0.00015 },
      outputTokenPriceUsdPer1K: { toNumber: () => 0.0006 },
      enabled: true,
    };
    let createModelCallArgs: { data: Record<string, unknown> } | undefined;
    const createModelCall = (args: {
      data: Record<string, unknown>;
    }): Promise<{ id: string; createdAt: Date }> => {
      createModelCallArgs = args;
      return Promise.resolve({
        id: 'call_error',
        createdAt: new Date('2026-05-24T00:00:00.000Z'),
      });
    };
    const prisma = {
      modelConfig: {
        findFirst: jest.fn().mockResolvedValue(modelConfig),
        findUnique: jest.fn().mockResolvedValue(modelConfig),
      },
      modelCall: {
        create: createModelCall,
      },
    };
    const provider = {
      generate: jest
        .fn()
        .mockRejectedValue(
          new ProviderRequestError(
            'Missing API key env OPENAI_COMPATIBLE_API_KEY',
            'missing_api_key',
          ),
        ),
    };
    const modelProviderService = {
      getProvider: jest.fn().mockReturnValue(provider),
    };
    const configService = { get: jest.fn() };
    const service = new ModelGatewayService(
      prisma as never,
      modelProviderService as never,
      configService as never,
    );

    await expect(
      service.complete({
        messages: [{ role: 'user', content: '介绍模型网关' }],
        temperature: 0.2,
        maxOutputTokens: 128,
        traceName: 'model-gateway.test',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(createModelCallArgs).toMatchObject({
      data: {
        status: ModelCallStatus.ERROR,
        errorCode: 'missing_api_key',
      },
    });
  });
});
