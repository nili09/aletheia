/** Types for the Emscripten build of the Swiss Ephemeris (see ../wasm/build.mjs). */
import type { SwissEphModule } from '../src/swe/module.ts';

export default function createSwissEph(moduleArg?: {
  wasmBinary?: ArrayBuffer | Uint8Array;
  locateFile?: (path: string, scriptDirectory: string) => string;
}): Promise<SwissEphModule>;
