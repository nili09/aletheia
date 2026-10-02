import { readFileSync } from 'node:fs';
import { Engine, EPHE_FILES, type EpheFile } from '../src/index.ts';

const epheDir = new URL('../ephe/', import.meta.url);

export function readEphe(name: EpheFile): Uint8Array {
  return new Uint8Array(readFileSync(new URL(name, epheDir)));
}

/** An engine with the given files loaded (all by default). */
export async function loadEngine(files: readonly EpheFile[] = EPHE_FILES): Promise<Engine> {
  const engine = await Engine.create();
  for (const f of files) engine.addFile(f, readEphe(f));
  return engine;
}

export function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as T;
}

export const ARCSEC = 1 / 3600;
