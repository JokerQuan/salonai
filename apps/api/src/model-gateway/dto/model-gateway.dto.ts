import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModelProviderKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({ enum: ['system', 'user', 'assistant'] })
  @IsIn(['system', 'user', 'assistant'])
  role!: 'system' | 'user' | 'assistant';

  @ApiProperty({ example: '用一句话介绍模型网关' })
  @IsString()
  content!: string;
}

export class CreateModelCompletionDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @ApiPropertyOptional({ example: 'clw_model_config_id' })
  @IsOptional()
  @IsString()
  modelConfigId?: string;

  @ApiPropertyOptional({ example: 0.2, minimum: 0, maximum: 2, default: 0.2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    example: 512,
    minimum: 1,
    maximum: 4096,
    default: 512,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4096)
  maxOutputTokens?: number;

  @ApiPropertyOptional({ example: 'model-gateway.completion' })
  @IsOptional()
  @IsString()
  traceName?: string;

  @ApiPropertyOptional({ example: { source: 'web-day1' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string | number | boolean>;
}

export class TokenUsageDto {
  @ApiProperty({ example: 10 })
  inputTokens!: number;

  @ApiProperty({ example: 8 })
  outputTokens!: number;

  @ApiProperty({ example: 18 })
  totalTokens!: number;
}

export class CostEstimateDto {
  @ApiProperty({ example: 0 })
  inputUsd!: number;

  @ApiProperty({ example: 0 })
  outputUsd!: number;

  @ApiProperty({ example: 0 })
  totalUsd!: number;
}

export class ModelCompletionResponseDto {
  @ApiProperty({ example: 'cmpl_call_real' })
  id!: string;

  @ApiProperty({ example: 'call_real' })
  modelCallId!: string;

  @ApiProperty({
    enum: ModelProviderKind,
    example: ModelProviderKind.OPENAI_COMPATIBLE,
  })
  providerKind!: ModelProviderKind;

  @ApiProperty({ example: 'gpt-4o-mini' })
  model!: string;

  @ApiProperty({ example: '模型网关统一了模型调用入口。' })
  outputText!: string;

  @ApiProperty({ type: TokenUsageDto })
  usage!: TokenUsageDto;

  @ApiProperty({ type: CostEstimateDto })
  costEstimate!: CostEstimateDto;

  @ApiProperty({ example: 12 })
  latencyMs!: number;

  @ApiProperty({ nullable: true, example: null })
  langfuseTraceId!: string | null;

  @ApiProperty({ nullable: true, example: null })
  langfuseGenerationId!: string | null;

  @ApiProperty({ example: '2026-05-24T00:00:00.000Z' })
  createdAt!: string;
}

export class ModelConfigSummaryDto {
  @ApiProperty({ example: 'cfg_real' })
  id!: string;

  @ApiProperty({ example: 'day1-openai-compatible' })
  name!: string;

  @ApiProperty({
    enum: ModelProviderKind,
    example: ModelProviderKind.OPENAI_COMPATIBLE,
  })
  providerKind!: ModelProviderKind;

  @ApiProperty({ example: 'gpt-4o-mini' })
  model!: string;

  @ApiProperty({ example: true })
  enabled!: boolean;
}
