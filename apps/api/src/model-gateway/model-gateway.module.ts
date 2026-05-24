import { Module } from '@nestjs/common';
import { ModelGatewayController } from './model-gateway.controller';
import { ModelGatewayService } from './model-gateway.service';
import { MockModelProvider } from './providers/mock-model.provider';
import { ModelProviderService } from './providers/model-provider.service';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

@Module({
  controllers: [ModelGatewayController],
  providers: [
    ModelGatewayService,
    ModelProviderService,
    MockModelProvider,
    OpenAiCompatibleProvider,
  ],
  exports: [ModelGatewayService],
})
export class ModelGatewayModule {}
