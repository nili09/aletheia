#!/usr/bin/env node
/**
 * Compile the official Swiss Ephemeris C library to WebAssembly with Emscripten.
 *
 *   node packages/engine/wasm/build.mjs
 *
 * Inputs (pinned in ./swisseph.lock.json):
 *   - Astrodienst's repository https://github.com/aloistr/swisseph at an exact commit,
 *     cloned into .tools/swisseph (git-ignored)
 *   - Emscripten from EMSDK (env var) or .tools/emsdk (git-ignored), version recorded below
 *
 * Outputs (committed, so the app builds on Cloudflare without Emscripten):
 *   - packages/engine/vendor/swisseph.mjs   ES-module loader
 *   - packages/engine/vendor/swisseph.wasm  the library
 *   - packages/engine/vendor/BUILD.json     exact inputs, flags and SHA-256 of the outputs
 *   - packages/engine/ephe/*                data files copied from the same commit
 *
 * The build is reproducible: same commit + same Emscripten version => same bytes.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const engine = join(here, '..');
const repoRoot = join(engine, '..', '..');
const lock = JSON.parse(readFileSync(join(here, 'swisseph.lock.json'), 'utf8'));

const src = join(repoRoot, '.tools', 'swisseph');
const emsdk = process.env.EMSDK ?? join(repoRoot, '.tools', 'emsdk');
// emcc is a Python program; calling emcc.py directly avoids shell quoting of paths with spaces.
const emccPy = join(emsdk, 'upstream', 'emscripten', 'emcc.py');
const python = process.env.EMSDK_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', ...opts });
const emcc = (args, opts) => run(python, [emccPy, ...args], opts);

// 1. Sources at the pinned commit.
if (!existsSync(src)) {
  run('git', ['clone', '--quiet', lock.repository, src]);
}
run('git', ['-C', src, 'fetch', '--quiet', 'origin']);
run('git', ['-C', src, 'checkout', '--quiet', '--detach', lock.commit]);
const head = run('git', ['-C', src, 'rev-parse', 'HEAD']).trim();
if (head !== lock.commit) throw new Error(`Swiss Ephemeris checkout is ${head}, lock says ${lock.commit}`);
const version = /#define SE_VERSION\s+"([^"]+)"/.exec(readFileSync(join(src, 'sweph.h'), 'utf8'))?.[1];
if (version !== lock.version) throw new Error(`SE_VERSION is ${version}, lock says ${lock.version}`);

// 2. Emscripten.
if (!existsSync(emccPy)) {
  throw new Error(`emcc not found at ${emccPy}. Install emsdk (docs/INSTALL.md) or set EMSDK.`);
}
const emccVersion = emcc(['--version']).split('\n')[0].trim();
if (!emccVersion.includes(lock.emscripten)) {
  throw new Error(`Emscripten is "${emccVersion}", lock says ${lock.emscripten}`);
}

// 3. Compile. The library sources are exactly the Makefile's SWEOBJ list.
const sources = ['swedate.c', 'swehouse.c', 'swejpl.c', 'swemmoon.c', 'swemplan.c', 'sweph.c', 'swephlib.c', 'swecl.c', 'swehel.c'];
const exported = lock.exportedFunctions.map((f) => `_${f}`).concat(['_malloc', '_free']);
const runtime = ['FS', 'HEAPF64', 'HEAP32', 'HEAPU8', 'UTF8ToString', 'stringToUTF8', 'lengthBytesUTF8'];

const out = join(engine, 'vendor');
mkdirSync(out, { recursive: true });

const flags = [
  '-O3',
  // Exact IEEE-754 arithmetic: no contraction into fused multiply-add, no fast-math.
  '-ffp-contract=off',
  '-fno-fast-math',
  '-sMODULARIZE=1',
  '-sEXPORT_ES6=1',
  '-sEXPORT_NAME=createSwissEph',
  '-sENVIRONMENT=web,worker,node',
  '-sFILESYSTEM=1',
  '-sFORCE_FILESYSTEM=1',
  '-sALLOW_MEMORY_GROWTH=1',
  // Swiss Ephemeris keeps sizeable arrays on the stack (eclipse and house code).
  '-sSTACK_SIZE=1048576',
  '-sASSERTIONS=0',
  `-sEXPORTED_FUNCTIONS=${exported.join(',')}`,
  `-sEXPORTED_RUNTIME_METHODS=${runtime.join(',')}`,
];

emcc([...flags, ...sources.map((s) => join(src, s)), '-o', join(out, 'swisseph.mjs')], { cwd: src });

// 4. Data files from the same commit.
const ephe = join(engine, 'ephe');
mkdirSync(ephe, { recursive: true });
for (const f of lock.dataFiles) copyFileSync(join(src, 'ephe', f), join(ephe, f));

// 5. Record exactly what was built.
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const build = {
  swissEphemeris: { repository: lock.repository, commit: head, version },
  emscripten: emccVersion,
  flags,
  sources,
  outputs: {
    'swisseph.mjs': sha(join(out, 'swisseph.mjs')),
    'swisseph.wasm': sha(join(out, 'swisseph.wasm')),
  },
  dataFiles: Object.fromEntries(lock.dataFiles.map((f) => [f, sha(join(ephe, f))])),
};
writeFileSync(join(out, 'BUILD.json'), `${JSON.stringify(build, null, 2)}\n`);
console.log(JSON.stringify(build, null, 2));
