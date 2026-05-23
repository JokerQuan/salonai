import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@salonai/shared';

const API_VERSION = '0.0.0';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({
    description: 'SalonAI API health status',
    schema: {
      example: {
        status: 'ok',
        service: 'salonai-api',
        timestamp: '2026-05-24T00:00:00.000Z',
        version: API_VERSION,
      },
    },
  })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'salonai-api',
      timestamp: new Date().toISOString(),
      version: API_VERSION,
    };
  }
}
