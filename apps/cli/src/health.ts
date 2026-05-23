import { healthResponseSchema } from '@salonai/shared';

const DEFAULT_API_URL = 'http://localhost:3000';

export function buildHealthUrl(apiUrl: string | undefined): string {
  const baseUrl = (apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
  return `${baseUrl}/health`;
}

export async function runHealthCommand(apiUrl = process.env.SALONAI_API_URL): Promise<void> {
  const healthUrl = buildHealthUrl(apiUrl);
  const response = await fetch(healthUrl);

  if (!response.ok) {
    throw new Error(`Health request failed with ${response.status}`);
  }

  const health = healthResponseSchema.parse(await response.json());
  console.log(`${health.service} ${health.status} ${health.version} ${health.timestamp}`);
}
