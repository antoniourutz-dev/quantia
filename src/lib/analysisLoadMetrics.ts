const formatDuration = (value: number) => `${Math.round(value)}ms`;

const mark = (name: string) => {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
  performance.mark(name);
};

const measure = (name: string, startMark: string, endMark: string) => {
  if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return;

  try {
    performance.measure(name, startMark, endMark);
  } catch {
    return;
  }

  if (!import.meta.env.DEV) return;

  const entries = performance.getEntriesByName(name);
  const last = entries[entries.length - 1];
  if (!last) return;
  console.info(`[analysis-perf] ${name}: ${formatDuration(last.duration)}`);
};

export type AnalysisLoadTrace = {
  cycleId: string;
  startMark: string;
  level1Mark: string;
  ctaMark: string;
  hydratedMark: string;
  reviewMark: string;
};

export const createAnalysisLoadTrace = (scope: string): AnalysisLoadTrace => {
  const cycleId = `${scope}:${Date.now()}`;
  const startMark = `quantia:analysis:${cycleId}:start`;
  const level1Mark = `quantia:analysis:${cycleId}:level1`;
  const ctaMark = `quantia:analysis:${cycleId}:cta`;
  const hydratedMark = `quantia:analysis:${cycleId}:hydrated`;
  const reviewMark = `quantia:analysis:${cycleId}:review`;

  mark(startMark);

  if (import.meta.env.DEV) {
    console.info(`[analysis-perf] cycle started: ${cycleId}`);
  }

  return { cycleId, startMark, level1Mark, ctaMark, hydratedMark, reviewMark };
};

export const markAnalysisLevel1Ready = (trace: AnalysisLoadTrace) => {
  mark(trace.level1Mark);
  measure(`quantia:analysis:${trace.cycleId}:time-to-level1`, trace.startMark, trace.level1Mark);
};

export const markAnalysisCtaVisible = (trace: AnalysisLoadTrace) => {
  mark(trace.ctaMark);
  measure(`quantia:analysis:${trace.cycleId}:time-to-cta`, trace.startMark, trace.ctaMark);
};

export const markAnalysisHydrated = (trace: AnalysisLoadTrace) => {
  mark(trace.hydratedMark);
  measure(`quantia:analysis:${trace.cycleId}:time-to-hydrated`, trace.startMark, trace.hydratedMark);
  measure(`quantia:analysis:${trace.cycleId}:level1-to-hydrated`, trace.level1Mark, trace.hydratedMark);
};

export const markAnalysisReviewVisible = (trace: AnalysisLoadTrace) => {
  mark(trace.reviewMark);
  measure(`quantia:analysis:${trace.cycleId}:time-to-review`, trace.startMark, trace.reviewMark);
};

