import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ModelGatewayService } from './model-gateway.service';
import {
  CreateModelCompletionDto,
  ModelCompletionResponseDto,
  ModelConfigSummaryDto,
} from './dto/model-gateway.dto';

@ApiTags('model-gateway')
@Controller('model-gateway')
export class ModelGatewayController {
  constructor(private readonly modelGatewayService: ModelGatewayService) {}

  @Get('configs')
  @ApiOperation({
    operationId: 'listModelConfigs',
    summary: 'List enabled model configs',
  })
  @ApiOkResponse({ type: [ModelConfigSummaryDto] })
  listConfigs(): Promise<ModelConfigSummaryDto[]> {
    return this.modelGatewayService.listEnabledConfigs();
  }

  @Post('completions')
  @ApiOperation({
    operationId: 'createModelCompletion',
    summary: 'Create a non-streaming model completion',
  })
  @ApiCreatedResponse({ type: ModelCompletionResponseDto })
  createCompletion(
    @Body() body: CreateModelCompletionDto,
  ): Promise<ModelCompletionResponseDto> {
    return this.modelGatewayService.complete({
      modelConfigId: body.modelConfigId,
      messages: body.messages,
      temperature: body.temperature ?? 0.2,
      maxOutputTokens: body.maxOutputTokens ?? 512,
      traceName: body.traceName ?? 'model-gateway.completion',
      metadata: body.metadata,
    });
  }
}
