import type { CoachPrimaryAction } from '../types';

export type TelemetrySurface = 'home' | 'stats' | 'review' | 'session_end' | 'test' | 'entry';

export type TelemetryDecisionEvent = {
  kind: 'decision';
  timestamp: string;
  surface: TelemetrySurface;
  curriculum?: string;
  dominantState?: string | null;
  primaryAction?: CoachPrimaryAction | null;
  uiAction?: string | null;
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

const writeStoredEvents = (events: TelemetryEvent[]) => {
  try {
    window.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(events.slice(-TELEMETRY_MAX_EVENTS)));
  } catch {
    void 0;
  }
};

const nowIso = () => new Date().toISOString();

const COACH_PRIMARY_ACTIONS = new Set<CoachPrimaryAction>([
  'review',
  'standard',
  'simulacro',
  'anti_trap',
  'recovery',
  'push',
]);

const toCoachPrimaryAction = (value: unknown): CoachPrimaryAction | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return COACH_PRIMARY_ACTIONS.has(normalized as CoachPrimaryAction)
    ? (normalized as CoachPrimaryAction)
    : null;
};

const readStoredEvents = (): TelemetryEvent[] => {
  try {
    const raw = window.localStorage.getItem(TELEMETRY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => (row && typeof row === 'object' ? (row as Record<string, unknown>) : null))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map((event) => {
        if (event.kind === 'decision') {
          const rawPrimary = typeof event.primaryAction === 'string' ? event.primaryAction : null;
          const coachPrimaryAction = toCoachPrimaryAction(rawPrimary);
          const existingUiAction =
            typeof event.uiAction === 'string' && event.uiAction.trim() ? event.uiAction.trim() : null;
          const fallbackUiAction =
            coachPrimaryAction == null && typeof rawPrimary === 'string' && rawPrimary.trim()
              ? rawPrimary.trim()
              : null;
          return {
            ...event,
            primaryAction: coachPrimaryAction,
            uiAction: existingUiAction ?? fallbackUiAction,
          } as TelemetryEvent;
        }
        return event as TelemetryEvent;
      })
      .filter(Boolean) as TelemetryEvent[];
  } catch {
    return [];
  }
};

type TelemetryDecisionInput = Omit<TelemetryDecisionEvent, 'kind' | 'timestamp' | 'primaryAction'> & {
  primaryAction?: string | null;
};

export const trackDecision = (input: TelemetryDecisionInput) => {
  const coachPrimaryAction = toCoachPrimaryAction(input.primaryAction);
  const fallbackUiAction =
    coachPrimaryAction == null && typeof input.primaryAction === 'string' && input.primaryAction.trim()
      ? input.primaryAction.trim()
      : null;
  const events = readStoredEvents();
  events.push({
    kind: 'decision',
    timestamp: nowIso(),
    ...input,
    primaryAction: coachPrimaryAction,
    uiAction: input.uiAction ?? fallbackUiAction,
  });
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
    void 0;
  }
};

export const trackDecisionOnce = (
  dedupeKey: string,
  input: TelemetryDecisionInput,
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
