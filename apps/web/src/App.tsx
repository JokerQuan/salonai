import { useState, type FormEvent } from 'react';
import {
  useCreateModelCompletion,
  useHealthControllerGetHealth,
  useListModelConfigs,
} from '@salonai/api-client';
import {
  healthResponseSchema,
  modelGatewayResponseSchema,
  type HealthResponse,
  type ModelGatewayResponse,
} from '@salonai/shared';
import './App.css';

function App() {
  const [prompt, setPrompt] = useState('用一句话介绍 SalonAI 模型网关');
  const healthQuery = useHealthControllerGetHealth();
  const configsQuery = useListModelConfigs();
  const completionMutation = useCreateModelCompletion<Error>();
  const health: HealthResponse | null = healthQuery.data
    ? healthResponseSchema.parse(healthQuery.data.data)
    : null;
  const configs = configsQuery.data?.data ?? [];
  const completion: ModelGatewayResponse | null = completionMutation.data
    ? modelGatewayResponseSchema.parse(completionMutation.data.data)
    : null;

  function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      return;
    }

    completionMutation.mutate({
      data: {
        messages: [{ role: 'user', content: trimmedPrompt }],
        temperature: 0.2,
        maxOutputTokens: 512,
        traceName: 'web.day1.model-gateway',
        metadata: { source: 'web-day1' },
      },
    });
  }

  return (
    <main className="app-shell">
      <section className="status-panel" aria-labelledby="status-title">
        <div>
          <p className="eyebrow">SalonAI Engineering Baseline</p>
          <h1 id="status-title">Day 1 Model Gateway</h1>
        </div>

        {healthQuery.isLoading && <p className="status muted">Checking API...</p>}

        {health && (
          <dl className="health-grid">
            <div>
              <dt>Status</dt>
              <dd className="ok">{health.status}</dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>{health.service}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{health.version}</dd>
            </div>
            <div>
              <dt>Timestamp</dt>
              <dd>{health.timestamp}</dd>
            </div>
          </dl>
        )}

        {healthQuery.isError && (
          <p className="status error">API unavailable: {readErrorMessage(healthQuery.error)}</p>
        )}
      </section>

      <section className="gateway-panel" aria-labelledby="gateway-title">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Non-streaming completion</p>
            <h2 id="gateway-title">Model Gateway</h2>
          </div>
          <p className="provider-pill">
            {configs[0]
              ? `${configs[0].providerKind} / ${configs[0].model}`
              : 'Config loading'}
          </p>
        </div>

        <form className="gateway-form" onSubmit={submitPrompt}>
          <label htmlFor="gateway-prompt">Prompt</label>
          <textarea
            id="gateway-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={5}
          />
          <div className="action-row">
            <button
              type="submit"
              disabled={completionMutation.isPending || prompt.trim().length === 0}
            >
              {completionMutation.isPending ? 'Running...' : 'Run model gateway'}
            </button>
            {completionMutation.isError && (
              <span className="status error">
                Model call failed: {readErrorMessage(completionMutation.error)}
              </span>
            )}
          </div>
        </form>

        {completion && (
          <div className="completion-result">
            <p>{completion.outputText}</p>
            <dl className="result-grid">
              <div>
                <dt>Model</dt>
                <dd>{completion.model}</dd>
              </div>
              <div>
                <dt>Latency</dt>
                <dd>{completion.latencyMs} ms</dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd>{completion.usage.totalTokens}</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd>${completion.costEstimate.totalUsd.toFixed(8)}</dd>
              </div>
              <div>
                <dt>Trace</dt>
                <dd>{completion.langfuseTraceId ?? 'not captured'}</dd>
              </div>
              <div>
                <dt>Generation</dt>
                <dd>{completion.langfuseGenerationId ?? 'not captured'}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>
    </main>
  );
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export default App;
