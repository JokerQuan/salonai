import { ModelProviderKind } from '@prisma/client';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import { ProviderRequestError } from './model-provider.types';

describe('OpenAiCompatibleProvider', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.OPENAI_COMPATIBLE_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_COMPATIBLE_API_KEY = originalEnv;
  });

  it('calls an OpenAI-compatible chat completions endpoint', async () => {
    process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '模型网关统一了模型调用入口。' } }],
          usage: { prompt_tokens: 12, completion_tokens: 9, total_tokens: 21 },
        }),
    });
    global.fetch = fetchMock;

    const provider = new OpenAiCompatibleProvider();
    const result = await provider.generate({
      config: {
        id: 'cfg_openai',
        providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
        model: 'gpt-4o-mini',
        baseUrl: 'https://api.example.test/v1',
        apiKeyEnvName: 'OPENAI_COMPATIBLE_API_KEY',
      },
      messages: [{ role: 'user', content: '介绍模型网关' }],
      temperature: 0.2,
      maxOutputTokens: 128,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: '介绍模型网关' }],
          temperature: 0.2,
          max_tokens: 128,
          stream: false,
        }),
      },
    );
    expect(result.outputText).toBe('模型网关统一了模型调用入口。');
    expect(result.usage).toEqual({
      inputTokens: 12,
      outputTokens: 9,
      totalTokens: 21,
    });
  });

  it('throws a typed provider error when the API key is missing', async () => {
    delete process.env.OPENAI_COMPATIBLE_API_KEY;
    const provider = new OpenAiCompatibleProvider();

    await expect(
      provider.generate({
        config: {
          id: 'cfg_openai',
          providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
          model: 'gpt-4o-mini',
          baseUrl: 'https://api.example.test/v1',
          apiKeyEnvName: 'OPENAI_COMPATIBLE_API_KEY',
        },
        messages: [{ role: 'user', content: '介绍模型网关' }],
        temperature: 0.2,
        maxOutputTokens: 128,
      }),
    ).rejects.toEqual(
      new ProviderRequestError(
        'Missing API key env OPENAI_COMPATIBLE_API_KEY',
        'missing_api_key',
      ),
    );
  });
});
