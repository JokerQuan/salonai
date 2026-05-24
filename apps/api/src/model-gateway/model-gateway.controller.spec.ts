import { Test, TestingModule } from '@nestjs/testing';
import { ModelProviderKind } from '@prisma/client';
import { ModelGatewayController } from './model-gateway.controller';
import { ModelGatewayService } from './model-gateway.service';

describe('ModelGatewayController', () => {
  let controller: ModelGatewayController;
  let service: {
    complete: jest.Mock;
    listEnabledConfigs: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      complete: jest.fn().mockResolvedValue({
        id: 'cmpl_call_1',
        modelCallId: 'call_1',
        providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
        model: 'gpt-4o-mini',
        outputText: '模型网关统一了模型调用入口。',
        usage: { inputTokens: 8, outputTokens: 10, totalTokens: 18 },
        costEstimate: { inputUsd: 0, outputUsd: 0, totalUsd: 0 },
        latencyMs: 120,
        langfuseTraceId: 'trace_1',
        langfuseGenerationId: 'gen_1',
        createdAt: '2026-05-24T00:00:00.000Z',
      }),
      listEnabledConfigs: jest.fn().mockResolvedValue([
        {
          id: 'cfg_1',
          name: 'day1-openai-compatible',
          providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
          model: 'gpt-4o-mini',
          enabled: true,
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelGatewayController],
      providers: [{ provide: ModelGatewayService, useValue: service }],
    }).compile();

    controller = module.get<ModelGatewayController>(ModelGatewayController);
  });

  it('submits a non-streaming model gateway completion request', async () => {
    const request = {
      messages: [{ role: 'user' as const, content: '介绍模型网关' }],
      temperature: 0.2,
      maxOutputTokens: 128,
      traceName: 'model-gateway.controller-test',
      metadata: { source: 'jest' },
    };

    await expect(controller.createCompletion(request)).resolves.toMatchObject({
      modelCallId: 'call_1',
      providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
      outputText: '模型网关统一了模型调用入口。',
    });
    expect(service.complete).toHaveBeenCalledWith(request);
  });

  it('lists enabled model configs', async () => {
    await expect(controller.listConfigs()).resolves.toEqual([
      {
        id: 'cfg_1',
        name: 'day1-openai-compatible',
        providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
        model: 'gpt-4o-mini',
        enabled: true,
      },
    ]);
  });
});
