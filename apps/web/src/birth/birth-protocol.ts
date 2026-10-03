import type { BirthPlace, IndexedPlace, LocalTime, PlaceMatch, TimeResolution } from '@aletheia/birth';

export interface BirthMethods {
  search: { params: { query: string; limit: number }; result: { matches: PlaceMatch[]; source: string } };
  locate: { params: { latitude: number; longitude: number }; result: { zone: string; nearest: { place: IndexedPlace; km: number } } };
  resolve: { params: { local: LocalTime; place: BirthPlace }; result: TimeResolution };
  zoneInfo: { params: Record<string, never>; result: { tzdb: string; source: string } };
}

export interface BirthRequest {
  id: number;
  method: keyof BirthMethods;
  params: unknown;
}

export type BirthResponse = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };
