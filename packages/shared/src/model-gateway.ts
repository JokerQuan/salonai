import { z } from 'zod';

export const modelProviderKindSchema = z.enum(['MOCK', 'OPENAI_COMPATIBLE']);

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1),
});

export const modelGatewayRequestSchema = z.object({
  modelConfigId: z.string().min(1).optional(),
  messages: z.array(chatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).default(0.2),
  maxOutputTokens: z.number().int().min(1).max(4096).default(512),
  traceName: z.string().min(1).max(120).default('model-gateway.completion'),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const tokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export const costEstimateSchema = z.object({
  inputUsd: z.number().nonnegative(),
  outputUsd: z.number().nonnegative(),
  totalUsd: z.number().nonnegative(),
});

export const modelGatewayResponseSchema = z.object({
  id: z.string().min(1),
  modelCallId: z.string().min(1),
  providerKind: modelProviderKindSchema,
  model: z.string().min(1),
  outputText: z.string(),
  usage: tokenUsageSchema,
  costEstimate: costEstimateSchema,
  latencyMs: z.number().int().nonnegative(),
  langfuseTraceId: z.string().nullable(),
  langfuseGenerationId: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const modelConfigSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  providerKind: modelProviderKindSchema,
  model: z.string(),
  enabled: z.boolean(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ModelProviderKind = z.infer<typeof modelProviderKindSchema>;
export type ModelGatewayRequest = z.infer<typeof modelGatewayRequestSchema>;
export type TokenUsage = z.infer<typeof tokenUsageSchema>;
export type CostEstimate = z.infer<typeof costEstimateSchema>;
export type ModelGatewayResponse = z.infer<typeof modelGatewayResponseSchema>;
export type ModelConfigSummary = z.infer<typeof modelConfigSummarySchema>;

export type ModelPricing = {
  inputTokenPriceUsdPer1K: number;
  outputTokenPriceUsdPer1K: number;
};

export function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

export function estimateChatInputTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => {
    return total + estimateTextTokens(`${message.role}: ${message.content}`);
  }, 0);
}

export function calculateCostEstimate(usage: TokenUsage, pricing: ModelPricing): CostEstimate {
  const inputUsd = roundUsd((usage.inputTokens / 1000) * pricing.inputTokenPriceUsdPer1K);
  const outputUsd = roundUsd((usage.outputTokens / 1000) * pricing.outputTokenPriceUsdPer1K);

  return {
    inputUsd,
    outputUsd,
    totalUsd: roundUsd(inputUsd + outputUsd),
  };
}

function roundUsd(value: number): number {
  return Number(value.toFixed(8));
}
