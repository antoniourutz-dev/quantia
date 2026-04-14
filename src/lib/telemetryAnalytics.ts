import type { TelemetryDecisionEvent, TelemetryEffectEvent, TelemetryEvent, TelemetrySurface } from './telemetry';

export type TelemetryFilters = {
  surfaces: TelemetrySurface[] | 'all';
  primaryAction: string | 'all';
  dominantState: string | 'all';
  visibleCta: string;
  sinceDays: number | 'all';
};

export type TelemetryFunnel = {
  decisionsShown: number;
  ctaClicked: number;
  sessionsStarted: number;
  sessionsCompleted: number;
  returnedNextDay: number | null;
};

export type TelemetryDecisionRow = {
  surface: TelemetrySurface;
  primaryAction: string;
  visibleCta: string;
  dominantState: string;
  shown: number;
  clicked: number;
  sessionsStarted: number;
  sessionsCompleted: number;
  returnedNextDay: number;
  clickRate: number;
  completionRate: number;
};

export type TelemetrySignal = {
  kind: 'info' | 'warn';
  title: string;
  detail: string;
};

const normalizeText = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const parseTs = (value: string) => {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.getTime();
};

const isNextDay = (fromIso: string, toIso: string) => {
  const a = parseTs(fromIso);
  const b = parseTs(toIso);
  if (a == null || b == null) return false;
  return startOfDay(new Date(b)) - startOfDay(new Date(a)) === 24 * 60 * 60 * 1000;
};

const pickEffectInWindow = (effects: TelemetryEffectEvent[], afterTs: number, windowMs: number, action: TelemetryEffectEvent['action']) => {
  const until = afterTs + windowMs;
  for (const event of effects) {
    const ts = parseTs(event.timestamp);
    if (ts == null) continue;
    if (ts < afterTs) continue;
    if (ts > until) break;
    if (event.action === action) return true;
  }
  return false;
};

export const buildTelemetryReport = (events: TelemetryEvent[], filters: TelemetryFilters) => {
  const now = Date.now();
  const sinceTs =
    filters.sinceDays === 'all' ? null : now - filters.sinceDays * 24 * 60 * 60 * 1000;

  const surfaceSet =
    filters.surfaces === 'all' ? null : new Set<TelemetrySurface>(filters.surfaces);
  const primaryNorm = filters.primaryAction === 'all' ? null : normalizeText(filters.primaryAction);
  const stateNorm = filters.dominantState === 'all' ? null : normalizeText(filters.dominantState);
  const ctaNorm = normalizeText(filters.visibleCta);

  const filtered = events
    .filter((event) => {
      const ts = parseTs(event.timestamp);
      if (ts == null) return false;
      if (sinceTs != null && ts < sinceTs) return false;
      if (surfaceSet && !surfaceSet.has(event.surface)) return false;
      return true;
    })
    .sort((a, b) => (parseTs(a.timestamp) ?? 0) - (parseTs(b.timestamp) ?? 0));

  const decisions = filtered.filter((e): e is TelemetryDecisionEvent => e.kind === 'decision');
  const effects = filtered.filter((e): e is TelemetryEffectEvent => e.kind === 'effect');

  const filteredDecisions = decisions.filter((event) => {
    const pa = event.primaryAction ? normalizeText(event.primaryAction) : '';
    const state = event.dominantState ? normalizeText(String(event.dominantState)) : '';
    const cta = event.visibleCta ? normalizeText(event.visibleCta) : '';
    if (primaryNorm && pa !== primaryNorm) return false;
    if (stateNorm && state !== stateNorm) return false;
    if (ctaNorm && !cta.includes(ctaNorm)) return false;
    return true;
  });

  const effectsByCurriculum = new Map<string, TelemetryEffectEvent[]>();
  for (const event of effects) {
    const key = event.curriculum ?? '';
    if (!effectsByCurriculum.has(key)) effectsByCurriculum.set(key, []);
    effectsByCurriculum.get(key)!.push(event);
  }
  for (const list of effectsByCurriculum.values()) {
    list.sort((a, b) => (parseTs(a.timestamp) ?? 0) - (parseTs(b.timestamp) ?? 0));
  }

  const rowMap = new Map<string, Omit<TelemetryDecisionRow, 'clickRate' | 'completionRate'>>();

  for (const decision of filteredDecisions) {
    const surface = decision.surface;
    const primaryAction = decision.primaryAction ?? '(sin acción)';
    const visibleCta = decision.visibleCta ?? '(sin CTA)';
    const dominantState = decision.dominantState ?? '(sin estado)';
    const rowKey = `${surface}||${primaryAction}||${visibleCta}||${dominantState}`;
    const row =
      rowMap.get(rowKey) ??
      ({
        surface,
        primaryAction,
        visibleCta,
        dominantState,
        shown: 0,
        clicked: 0,
        sessionsStarted: 0,
        sessionsCompleted: 0,
        returnedNextDay: 0,
      } satisfies Omit<TelemetryDecisionRow, 'clickRate' | 'completionRate'>);

    row.shown += 1;

    const ts = parseTs(decision.timestamp);
    const curriculum = decision.curriculum ?? '';
    const timeline = effectsByCurriculum.get(curriculum) ?? [];
    if (ts != null) {
      const clicked = pickEffectInWindow(timeline, ts, 60 * 60 * 1000, 'cta_clicked');
      const started = pickEffectInWindow(timeline, ts, 60 * 60 * 1000, 'session_started');
      const completed = pickEffectInWindow(timeline, ts, 2 * 60 * 60 * 1000, 'session_completed');
      if (clicked) row.clicked += 1;
      if (started) row.sessionsStarted += 1;
      if (completed) row.sessionsCompleted += 1;

      const anyNextDay = timeline.some((event) => {
        if (event.action !== 'session_started') return false;
        return isNextDay(decision.timestamp, event.timestamp);
      });
      if (anyNextDay) row.returnedNextDay += 1;
    }

    rowMap.set(rowKey, row);
  }

  const rows: TelemetryDecisionRow[] = [...rowMap.values()].map((row) => ({
    ...row,
    clickRate: row.shown > 0 ? row.clicked / row.shown : 0,
    completionRate: row.shown > 0 ? row.sessionsCompleted / row.shown : 0,
  }));

  const funnel: TelemetryFunnel = {
    decisionsShown: filteredDecisions.length,
    ctaClicked: effects.filter((e) => e.action === 'cta_clicked').length,
    sessionsStarted: effects.filter((e) => e.action === 'session_started').length,
    sessionsCompleted: effects.filter((e) => e.action === 'session_completed').length,
    returnedNextDay: null,
  };

  const completed = effects.filter((e) => e.action === 'session_completed');
  if (completed.length > 0) {
    const started = effects.filter((e) => e.action === 'session_started');
    let returned = 0;
    for (const c of completed) {
      const curriculum = c.curriculum ?? '';
      const didReturn = started.some((s) => (s.curriculum ?? '') === curriculum && isNextDay(c.timestamp, s.timestamp));
      if (didReturn) returned += 1;
    }
    funnel.returnedNextDay = returned;
  }

  const signals: TelemetrySignal[] = [];
  const baseThreshold = 20;

  const weakest = [...rows]
    .filter((row) => row.shown >= baseThreshold)
    .sort((a, b) => a.clickRate - b.clickRate)
    .slice(0, 3);
  for (const row of weakest) {
    if (row.clickRate < 0.06) {
      signals.push({
        kind: 'warn',
        title: 'Se muestra mucho pero se pulsa poco',
        detail: `${row.surface} · ${row.primaryAction} · “${row.visibleCta}” (${row.shown} vistas, ${(row.clickRate * 100).toFixed(1)}% click).`,
      });
    }
  }

  const byActionKey = new Map<string, TelemetryDecisionRow[]>();
  for (const row of rows) {
    const key = `${row.surface}||${row.primaryAction}`;
    if (!byActionKey.has(key)) byActionKey.set(key, []);
    byActionKey.get(key)!.push(row);
  }

  for (const [key, group] of byActionKey.entries()) {
    const eligible = group.filter((row) => row.shown >= baseThreshold);
    if (eligible.length < 2) continue;
    const best = [...eligible].sort((a, b) => b.clickRate - a.clickRate)[0];
    const worst = [...eligible].sort((a, b) => a.clickRate - b.clickRate)[0];
    const diff = best.clickRate - worst.clickRate;
    if (diff >= 0.12) {
      const [surface, primaryAction] = key.split('||');
      signals.push({
        kind: 'info',
        title: 'La CTA importa mucho en esta decisión',
        detail: `${surface} · ${primaryAction}: “${best.visibleCta}” rinde mejor que “${worst.visibleCta}” (+${(diff * 100).toFixed(0)} pp).`,
      });
    }
  }

  const pressureRows = rows.filter((row) => normalizeText(row.primaryAction).includes('simulacro') || normalizeText(row.dominantState).includes('pressure'));
  const pressureShown = pressureRows.reduce((acc, row) => acc + row.shown, 0);
  if (pressureShown >= baseThreshold) {
    const avgCompletion = pressureRows.reduce((acc, row) => acc + row.sessionsCompleted, 0) / Math.max(pressureShown, 1);
    if (avgCompletion < 0.08) {
      signals.push({
        kind: 'warn',
        title: 'Bajo presión se inicia, pero se sostiene peor',
        detail: 'Revisa el encuadre del empuje a examen: quizá conviene hacerlo más corto y más frecuente, no más largo.',
      });
    }
  }

  return {
    filteredEvents: filtered,
    decisions: filteredDecisions,
    effects,
    funnel,
    rows,
    signals,
  };
};

