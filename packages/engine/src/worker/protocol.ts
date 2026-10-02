/**
 * Messages between the app (main thread) and the engine worker. Results are plain data,
 * so they cross the worker boundary by structured clone.
 */
import type { Ayanamsa } from '../ayanamsa.ts';
import type { LunarEclipse, SolarEclipse } from '../eclipses.ts';
import type { AstroEvent, EventCheck, EventKind } from '../events/events.ts';
import type { Graha, GrahaPosition } from '../grahas.ts';
import type { Houses, Place } from '../houses.ts';
import type { RiseConvention, RiseSet, RisingBody } from '../riseset.ts';
import type { FixedStar, Yogatara } from '../stars.ts';
import type { FileData } from '../swe/swisseph.ts';
import type { Instant } from '../time.ts';
import type { HorizonsReport } from '../verify/horizons.ts';
import type { Settings, TimeInput } from '../engine.ts';

/** Everything the Truth screen shows for one instant, in one round trip. */
export interface Snapshot {
  instant: Instant;
  version: string;
  settings: Settings;
  /** The nine grahas with the node kind from settings. */
  grahas: GrahaPosition[];
  /** Rahu and Ketu with the other node kind, for comparison. */
  otherNodes: GrahaPosition[];
  ayanamsa: Ayanamsa;
  houses: Houses;
  place: Place;
  files: FileData[];
}

export interface Methods {
  snapshot: { params: { time: TimeInput; place: Place; settings: Settings }; result: Snapshot };
  positions: { params: { time: TimeInput; settings: Settings }; result: GrahaPosition[] };
  ayanamsa: { params: { time: TimeInput; mode: number }; result: Ayanamsa };
  houses: { params: { time: TimeInput; place: Place; settings: Settings }; result: Houses };
  riseSet: { params: { time: TimeInput; body: RisingBody; place: Place; convention: RiseConvention }; result: RiseSet };
  solarEclipse: { params: { time: TimeInput; backward?: boolean }; result: SolarEclipse };
  lunarEclipse: { params: { time: TimeInput; backward?: boolean }; result: LunarEclipse };
  fixedStar: { params: { time: TimeInput; star: string; mode: number }; result: FixedStar };
  yogataras: { params: { time: TimeInput; mode: number }; result: Array<Yogatara & { position: FixedStar }> };
  events: { params: { start: TimeInput; end: TimeInput; kinds?: EventKind[]; grahas?: Graha[]; settings: Settings }; result: AstroEvent[] };
  nextEvents: { params: { time: TimeInput; count: number; kinds?: EventKind[]; grahas?: Graha[]; settings: Settings }; result: Array<AstroEvent & { check: EventCheck; unixMs: number }> };
  horizonsCheck: { params: Record<string, never>; result: HorizonsReport };
}

export type Method = keyof Methods;
export type Params<M extends Method> = Methods[M]['params'];
export type Result<M extends Method> = Methods[M]['result'];

export interface Request<M extends Method = Method> {
  id: number;
  method: M;
  params: Params<M>;
}

export type Response =
  | { id: number; ok: true; result: unknown; cached: boolean; ms: number }
  | { id: number; ok: false; error: { name: string; message: string } };
