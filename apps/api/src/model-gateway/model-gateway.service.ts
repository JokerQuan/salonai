import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getActiveTraceId,
  startActiveObservation,
  startObservation,
} from '@langfuse/tracing';
import { ModelCallStatus, ModelProviderKind, Prisma } from '@prisma/client';
import type {
  ChatMessage,
  CostEstimate,
  ModelGatewayRequest,
  ModelGatewayResponse,
  TokenUsage,
} from '@salonai/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ModelProviderService } from './providers/model-provider.service';
import { ProviderRequestError } from './providers/model-provider.types';

type ModelConfigForCall = {
  id: string;
  name: string;
  providerKind: ModelProviderKind;
  model: string;
  baseUrl: string | null;
  apiKeyEnvName: string | null;
  inputTokenPriceUsdPer1K: { toNumber(): number };
  outputTokenPriceUsdPer1K: { toNumber(): number };
  enabled: boolean;
};

@Injectable()
export class ModelGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modelProviderService: ModelProviderService,
    private readonly configService: ConfigService,
  ) {}

  async listEnabledConfigs() {
    const configs = await this.prisma.modelConfig.findMany({
      where: { enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        providerKind: true,
        model: true,
        enabled: true,
      },
    });

    if (configs.length > 0) {
      return configs;
    }

    const defaultConfig = await this.ensureDefaultOpenAiCompatibleConfig();
    return [
      {
        id: defaultConfig.id,
        name: defaultConfig.name,
        providerKind: defaultConfig.providerKind,
        model: defaultConfig.model,
        enabled: defaultConfig.enabled,
      },
    ];
  }

  async complete(input: ModelGatewayRequest): Promise<ModelGatewayResponse> {
    const request = normalizeModelGatewayRequest(input);
    const config = await this.resolveModelConfig(request.modelConfigId);
    const provider = this.modelProviderService.getProvider(config.providerKind);
    const startedAt = performance.now();
    let langfuseTraceId: string | null = null;
    let langfuseGenerationId: string | null = null;

    try {
      const providerResult = await startActiveObservation(
        request.traceName,
        async (span) => {
          span.update({
            input: {
              modelConfigId: config.id,
              providerKind: config.providerKind,
              model: config.model,
              messages: request.messages,
            },
            metadata: request.metadata,
          });

          const generation = startObservation(
            'model-gateway.generate',
            {
              model: config.model,
              input: request.messages,
              modelParameters: {
                temperature: request.temperature,
                maxOutputTokens: request.maxOutputTokens,
              },
            },
            { asType: 'generation' },
          );
          langfuseTraceId = getActiveTraceId() ?? null;
          langfuseGenerationId = generation.id ?? null;

          try {
            const result = await provider.generate({
              config,
              messages: request.messages,
              temperature: request.temperature,
              maxOutputTokens: request.maxOutputTokens,
            });

            generation
              .update({
                usageDetails: {
                  input: result.usage.inputTokens,
                  output: result.usage.outputTokens,
                  total: result.usage.totalTokens,
                },
                output: { content: result.outputText },
              })
              .end();

            span.update({ output: { content: result.outputText } });
            return result;
          } catch (error) {
            generation
              .update({
                output: {
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Unknown provider error',
                },
              })
              .end();
            throw error;
          }
        },
      );

      const latencyMs = Math.round(performance.now() - startedAt);
      const costEstimate = calculateCostEstimate(providerResult.usage, {
        inputTokenPriceUsdPer1K: config.inputTokenPriceUsdPer1K.toNumber(),
        outputTokenPriceUsdPer1K: config.outputTokenPriceUsdPer1K.toNumber(),
      });
      const call = await this.prisma.modelCall.create({
        data: {
          modelConfigId: config.id,
          providerKind: config.providerKind,
          model: config.model,
          status: ModelCallStatus.SUCCESS,
          inputTokens: providerResult.usage.inputTokens,
          outputTokens: providerResult.usage.outputTokens,
          totalTokens: providerResult.usage.totalTokens,
          costUsd: new Prisma.Decimal(costEstimate.totalUsd),
          latencyMs,
          langfuseTraceId,
          langfuseGenerationId,
          metadata: request.metadata ?? Prisma.JsonNull,
        },
      });

      return {
        id: `cmpl_${call.id}`,
        modelCallId: call.id,
        providerKind: config.providerKind,
        model: config.model,
        outputText: providerResult.outputText,
        usage: providerResult.usage,
        costEstimate,
        latencyMs,
        langfuseTraceId,
        langfuseGenerationId,
        createdAt: call.createdAt.toISOString(),
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startedAt);
      await this.prisma.modelCall.create({
        data: {
          modelConfigId: config.id,
          providerKind: config.providerKind,
          model: config.model,
          status: ModelCallStatus.ERROR,
          latencyMs,
          langfuseTraceId,
          langfuseGenerationId,
          errorCode:
            error instanceof ProviderRequestError
              ? error.code
              : 'model_gateway_error',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Unknown model gateway error',
          metadata: request.metadata ?? Prisma.JsonNull,
        },
      });

      throw new BadGatewayException('Model gateway call failed');
    }
  }

  private async resolveModelConfig(
    modelConfigId?: string,
  ): Promise<ModelConfigForCall> {
    if (modelConfigId) {
      const config = await this.prisma.modelConfig.findUnique({
        where: { id: modelConfigId },
      });

      if (!config || !config.enabled) {
        throw new BadGatewayException('Model config is not available');
      }

      return config;
    }

    const config = await this.prisma.modelConfig.findFirst({
      where: { enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    return config ?? (await this.ensureDefaultOpenAiCompatibleConfig());
  }

  private async ensureDefaultOpenAiCompatibleConfig(): Promise<ModelConfigForCall> {
    const existing = await this.prisma.modelConfig.findFirst({
      where: { name: 'day1-openai-compatible' },
    });

    if (existing) {
      return existing;
    }

    const baseUrl =
      this.configService.get<string>('OPENAI_COMPATIBLE_BASE_URL') ?? null;
    const model =
      this.configService.get<string>('OPENAI_COMPATIBLE_MODEL') ?? '';

    return await this.prisma.modelConfig.create({
      data: {
        name: 'day1-openai-compatible',
        providerKind: ModelProviderKind.OPENAI_COMPATIBLE,
        model,
        baseUrl,
        apiKeyEnvName: 'OPENAI_COMPATIBLE_API_KEY',
        priority: 1,
        inputTokenPriceUsdPer1K: new Prisma.Decimal(0),
        outputTokenPriceUsdPer1K: new Prisma.Decimal(0),
      },
    });
  }
}

type NormalizedModelGatewayRequest = {
  modelConfigId?: string;
  messages: ChatMessage[];
  temperature: number;
  maxOutputTokens: number;
  traceName: string;
  metadata?: Record<string, string | number | boolean>;
};

function normalizeModelGatewayRequest(
  input: ModelGatewayRequest,
): NormalizedModelGatewayRequest {
  if (!input.messages || input.messages.length === 0) {
    throw new BadGatewayException(
      'Model gateway request requires at least one message',
    );
  }

  return {
    modelConfigId: input.modelConfigId,
    messages: input.messages,
    temperature: input.temperature ?? 0.2,
    maxOutputTokens: input.maxOutputTokens ?? 512,
    traceName: input.traceName ?? 'model-gateway.completion',
    metadata: input.metadata,
  };
}

type ModelPricing = {
  inputTokenPriceUsdPer1K: number;
  outputTokenPriceUsdPer1K: number;
};

function calculateCostEstimate(
  usage: TokenUsage,
  pricing: ModelPricing,
): CostEstimate {
  const inputUsd = roundUsd(
    (usage.inputTokens / 1000) * pricing.inputTokenPriceUsdPer1K,
  );
  const outputUsd = roundUsd(
    (usage.outputTokens / 1000) * pricing.outputTokenPriceUsdPer1K,
  );

  return {
    inputUsd,
    outputUsd,
    totalUsd: roundUsd(inputUsd + outputUsd),
  };
}

function roundUsd(value: number): number {
  return Number(value.toFixed(8));
}
