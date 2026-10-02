/**
 * The app's side of the worker boundary: a typed, promise-based client. Every call is
 * asynchronous; the heavy maths happens in the worker, never on the main thread.
 */
import type { Method, Params, Request, Response, Result } from './protocol.ts';

/** The parts of a Web Worker the client uses (structural, so tests can pass a fake). */
export interface WorkerLike {
  postMessage(message: Request): void;
  addEventListener(type: 'message', listener: (e: { data: Response }) => void): void;
  addEventListener(type: 'error', listener: (e: { message?: string }) => void): void;
  terminate(): void;
}

export class EngineError extends Error {
  constructor(
    override readonly name: string,
    message: string,
  ) {
    super(message);
  }
}

export class EngineClient {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();

  constructor(private readonly worker: WorkerLike) {
    worker.addEventListener('message', (e: { data: Response }) => {
      const msg = e.data;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new EngineError(msg.error.name, msg.error.message));
    });
    worker.addEventListener('error', (e: { message?: string }) => {
      const err = new EngineError('WorkerError', e.message || 'engine worker failed');
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    });
  }

  call<M extends Method>(method: M, params: Params<M>): Promise<Result<M>> {
    const id = this.nextId++;
    return new Promise<Result<M>>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
      this.worker.postMessage({ id, method, params });
    });
  }

  terminate(): void {
    this.worker.terminate();
  }
}
