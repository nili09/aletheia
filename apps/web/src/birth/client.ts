import type { BirthMethods, BirthResponse } from './birth-protocol.ts';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();

/** A call to the birth worker, started on first use. */
export function birth<M extends keyof BirthMethods>(method: M, params: BirthMethods[M]['params']): Promise<BirthMethods[M]['result']> {
  if (!worker) {
    worker = new Worker(new URL('./birth.worker.ts', import.meta.url), { type: 'module', name: 'aletheia-birth' });
    worker.addEventListener('message', (e: MessageEvent<BirthResponse>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error));
    });
    worker.addEventListener('error', (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || 'birth worker failed'));
      pending.clear();
    });
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
    worker!.postMessage({ id, method, params });
  });
}
