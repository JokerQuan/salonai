import { describe, expect, it } from 'vitest';
import {
  calculateCostEstimate,
  estimateChatInputTokens,
  modelGatewayRequestSchema,
  modelGatewayResponseSchema,
} from './model-gateway.js';

describe('modelGatewayRequestSchema', () => {
  it('accepts a minimal chat completion request', () => {
    const request = modelGatewayRequestSchema.parse({
      messages: [{ role: 'user', content: '用一句话介绍模型网关' }],
    });

    expect(request.temperature).toBe(0.2);
    expect(request.maxOutputTokens).toBe(512);
    expect(request.traceName).toBe('model-gateway.completion');
  });

  it('rejects empty message lists', () => {
    expect(() => modelGatewayRequestSchema.parse({ messages: [] })).toThrow();
  });
});

describe('modelGatewayResponseSchema', () => {
  it('accepts a logged model response', () => {
    const response = modelGatewayResponseSchema.parse({
      id: 'cmpl_day1_mock',
      modelCallId: 'call_day1_mock',
      providerKind: 'MOCK',
      model: 'mock-salonai-day1',
      outputText: 'Mock response: 用一句话介绍模型网关',
      usage: { inputTokens: 8, outputTokens: 9, totalTokens: 17 },
      costEstimate: { inputUsd: 0, outputUsd: 0, totalUsd: 0 },
      latencyMs: 12,
      langfuseTraceId: null,
      langfuseGenerationId: null,
      createdAt: '2026-05-24T00:00:00.000Z',
    });

    expect(response.providerKind).toBe('MOCK');
  });
});

describe('token and cost helpers', () => {
  it('estimates input tokens from chat content', () => {
    expect(
      estimateChatInputTokens([
        { role: 'system', content: '你是 SalonAI 助手' },
        { role: 'user', content: '解释模型网关' },
      ]),
    ).toBeGreaterThan(0);
  });

  it('calculates cost from per-1k token prices', () => {
    expect(
      calculateCostEstimate(
        { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        { inputTokenPriceUsdPer1K: 0.01, outputTokenPriceUsdPer1K: 0.03 },
      ),
    ).toEqual({ inputUsd: 0.01, outputUsd: 0.015, totalUsd: 0.025 });
  });
});
