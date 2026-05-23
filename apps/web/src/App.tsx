import { useEffect, useState } from 'react';
import { healthResponseSchema, type HealthResponse } from '@salonai/shared';
import './App.css';

type HealthState =
  | { status: 'loading' }
  | { status: 'healthy'; data: HealthResponse }
  | { status: 'unavailable'; message: string };

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');

  if (!response.ok) {
    throw new Error(`Health request failed with ${response.status}`);
  }

  return healthResponseSchema.parse(await response.json());
}

function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetchHealth()
      .then((data) => {
        if (!cancelled) {
          setHealth({ status: 'healthy', data });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setHealth({
            status: 'unavailable',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="health-panel">
        <p className="eyebrow">SalonAI Engineering Baseline</p>
        <h1>Day 0B Health Check</h1>

        {health.status === 'loading' && <p className="status muted">Checking API...</p>}

        {health.status === 'healthy' && (
          <dl className="health-grid">
            <div>
              <dt>Status</dt>
              <dd className="ok">{health.data.status}</dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>{health.data.service}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{health.data.version}</dd>
            </div>
            <div>
              <dt>Timestamp</dt>
              <dd>{health.data.timestamp}</dd>
            </div>
          </dl>
        )}

        {health.status === 'unavailable' && (
          <p className="status error">API unavailable: {health.message}</p>
        )}
      </section>
    </main>
  );
}

export default App;
