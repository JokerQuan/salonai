import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | undefined;

export function startLangfuseInstrumentation(): NodeSDK | undefined {
  if (sdk) {
    return sdk;
  }

  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return undefined;
  }

  sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()],
  });
  sdk.start();
  return sdk;
}

export async function shutdownLangfuseInstrumentation(): Promise<void> {
  await sdk?.shutdown();
  sdk = undefined;
}
