import { ModelProviderKind } from '@prisma/client';
import { MockModelProvider } from './mock-model.provider';

describe('MockModelProvider', () => {
  it('returns deterministic output and estimated usage', async () => {
    const provider = new MockModelProvider();

    const result = await provider.generate({
      config: {
        id: 'cfg_mock',
        providerKind: ModelProviderKind.MOCK,
        model: 'mock-salonai-day1',
        baseUrl: null,
        apiKeyEnvName: null,
      },
      messages: [{ role: 'user', content: '介绍模型网关' }],
      temperature: 0.2,
      maxOutputTokens: 128,
    });

    expect(result.outputText).toBe('Mock response: 介绍模型网关');
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(result.usage.totalTokens).toBe(
      result.usage.inputTokens + result.usage.outputTokens,
    );
    expect(result.raw).toEqual({ provider: 'mock' });
  });
});
