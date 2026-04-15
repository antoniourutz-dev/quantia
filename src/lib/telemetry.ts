export type TelemetrySurface = 'home' | 'stats' | 'review' | 'session_end' | 'test' | 'entry';

export type TelemetryDecisionEvent = {
  kind: 'decision';
  timestamp: string;
  surface: TelemetrySurface;
  curriculum?: string;
  dominantState?: string | null;
  primaryAction?: string | null;
  tone?: string | null;
  visibleCta?: string | null;
  confidence?: 'low' | 'medium' | 'high' | null;
  context?: Record<string, unknown>;
};

export type TelemetryEffectEvent = {
  kind: 'effect';
  timestamp: string;
  surface: TelemetrySurface;
  curriculum?: string;
  action:
    | 'cta_clicked'
    | 'go_home'
    | 'session_started'
    | 'session_completed'
    | 'session_abandoned';
  context?: Record<string, unknown>;
};

export type TelemetryEvent = TelemetryDecisionEvent | TelemetryEffectEvent;

const TELEMETRY_STORAGE_KEY = 'quantia.telemetry.v1';
const TELEMETRY_DEDUPE_KEY = 'quantia.telemetry.dedupe.v1';
const TELEMETRY_MAX_EVENTS = 300;

const readStoredEvents = (): TelemetryEvent[] => {
  try {
    const raw = window.localStorage.getItem(TELEMETRY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean) as TelemetryEvent[];
  } catch {
    return [];
  }
};

const writeStoredEvents = (events: TelemetryEvent[]) => {
  try {
    window.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(events.slice(-TELEMETRY_MAX_EVENTS)));
  } catch {
  }
};

const nowIso = () => new Date().toISOString();

export const trackDecision = (input: Omit<TelemetryDecisionEvent, 'kind' | 'timestamp'>) => {
  const events = readStoredEvents();
  events.push({ kind: 'decision', timestamp: nowIso(), ...input });
  writeStoredEvents(events);
};

export const trackEffect = (input: Omit<TelemetryEffectEvent, 'kind' | 'timestamp'>) => {
  const events = readStoredEvents();
  events.push({ kind: 'effect', timestamp: nowIso(), ...input });
  writeStoredEvents(events);
};

export const getTelemetryEvents = () => readStoredEvents();

type DedupeMap = Record<string, number>;

const readDedupe = (): DedupeMap => {
  try {
    const raw = window.localStorage.getItem(TELEMETRY_DEDUPE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as DedupeMap;
  } catch {
    return {};
  }
};

const writeDedupe = (map: DedupeMap) => {
  try {
    window.localStorage.setItem(TELEMETRY_DEDUPE_KEY, JSON.stringify(map));
  } catch {
  }
};

export const trackDecisionOnce = (
  dedupeKey: string,
  input: Omit<TelemetryDecisionEvent, 'kind' | 'timestamp'>,
  ttlMs = 2 * 60 * 1000,
) => {
  const map = readDedupe();
  const now = Date.now();
  const last = map[dedupeKey] ?? 0;
  if (now - last < ttlMs) return;
  map[dedupeKey] = now;
  writeDedupe(map);
  trackDecision(input);
};
