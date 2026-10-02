import { EngineClient, type WorkerLike } from '@aletheia/engine/worker';

let client: EngineClient | null = null;

/** The app's one engine worker, started on first use (not at app start). */
export function engine(): EngineClient {
  client ??= new EngineClient(
    new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module', name: 'aletheia-engine' }) as unknown as WorkerLike,
  );
  return client;
}
