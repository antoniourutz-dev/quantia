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
  console.info(`[home-perf] ${name}: ${formatDuration(last.duration)}`);
};

export type HomeLoadTrace = {
  cycleId: string;
  startMark: string;
  heroMark: string;
  heroFinalMark: string;
  lcpNodeMark: string;
  primaryMark: string;
  ctaMark: string;
  hydratedMark: string;
};

export const createHomeLoadTrace = (scope: string): HomeLoadTrace => {
  const cycleId = `${scope}:${Date.now()}`;
  const startMark = `quantia:home:${cycleId}:start`;
  const heroMark = `quantia:home:${cycleId}:hero-visible`;
  const heroFinalMark = `quantia:home:${cycleId}:hero-final-ready`;
  const lcpNodeMark = `quantia:home:${cycleId}:lcp-node-mounted`;
  const primaryMark = `quantia:home:${cycleId}:primary-ready`;
  const ctaMark = `quantia:home:${cycleId}:cta-visible`;
  const hydratedMark = `quantia:home:${cycleId}:hydrated`;

  mark(startMark);

  if (import.meta.env.DEV) {
    console.info(`[home-perf] cycle started: ${cycleId}`);
  }

  return {
    cycleId,
    startMark,
    heroMark,
    heroFinalMark,
    lcpNodeMark,
    primaryMark,
    ctaMark,
    hydratedMark,
  };
};

export const markHomeHeroVisible = (trace: HomeLoadTrace) => {
  mark(trace.heroMark);
  measure(`quantia:home:${trace.cycleId}:time-to-hero`, trace.startMark, trace.heroMark);
};

export const markHomeHeroFinalReady = (trace: HomeLoadTrace) => {
  mark(trace.heroFinalMark);
  measure(`quantia:home:${trace.cycleId}:time-to-hero-final`, trace.startMark, trace.heroFinalMark);
  measure(`quantia:home:${trace.cycleId}:hero-to-hero-final`, trace.heroMark, trace.heroFinalMark);
};

export const markHomeLcpNodeMounted = (trace: HomeLoadTrace) => {
  mark(trace.lcpNodeMark);
  measure(`quantia:home:${trace.cycleId}:time-to-lcp-node-mounted`, trace.startMark, trace.lcpNodeMark);
  measure(`quantia:home:${trace.cycleId}:hero-final-to-lcp-node`, trace.heroFinalMark, trace.lcpNodeMark);
};

export const markHomePrimaryReady = (trace: HomeLoadTrace) => {
  mark(trace.primaryMark);
  measure(`quantia:home:${trace.cycleId}:time-to-primary`, trace.startMark, trace.primaryMark);
};

export const markHomeCtaVisible = (trace: HomeLoadTrace) => {
  mark(trace.ctaMark);
  measure(`quantia:home:${trace.cycleId}:time-to-cta`, trace.startMark, trace.ctaMark);
};

export const markHomeHydrated = (trace: HomeLoadTrace) => {
  mark(trace.hydratedMark);
  measure(`quantia:home:${trace.cycleId}:time-to-hydrated`, trace.startMark, trace.hydratedMark);
  measure(`quantia:home:${trace.cycleId}:primary-to-hydrated`, trace.primaryMark, trace.hydratedMark);
};
