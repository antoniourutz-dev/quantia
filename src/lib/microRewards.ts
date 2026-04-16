export type MicroReward = {
  id: string;
  title: string;
  detail: string;
};

export type MicroRewardContext = {
  locale: 'es' | 'eu';
  sessionState: string;
  didReturnAfterGap: boolean;
  reducedPending?: boolean;
  trainedPressure?: boolean;
};

const STORAGE_KEY = 'quantia.micro_reward.v1';

const readLastReward = (): { id: string; timestamp: string } | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    const id = record.id;
    const timestamp = record.timestamp;
    if (typeof id !== 'string' || typeof timestamp !== 'string') return null;
    return { id, timestamp };
  } catch {
    return null;
  }
};

const writeLastReward = (value: { id: string; timestamp: string }) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    void 0;
  }
};

const hoursSince = (iso: string) => {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return (Date.now() - parsed) / (60 * 60 * 1000);
};

const chance = (seed: string) => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 2 ** 32;
};

export const pickMicroReward = (ctx: MicroRewardContext, seed: string): MicroReward | null => {
  const last = readLastReward();
  if (last) {
    const ageHours = hoursSince(last.timestamp);
    if (ageHours != null && ageHours < 20) return null;
  }

  const roll = chance(seed);
  if (roll > 0.55) return null;

  const isBasque = ctx.locale === 'eu';

  const candidates: MicroReward[] = [];
  if (ctx.didReturnAfterGap) {
    candidates.push({
      id: 'back_to_habit',
      title: isBasque ? 'Oso ondo gaur agertzeagatik' : 'Bien por aparecer hoy',
      detail: isBasque ? 'Hori da aurrerapena finkatzen duena.' : 'Eso es lo que hace que el progreso se quede.',
    });
  }
  if (ctx.sessionState === 'repeated_errors') {
    candidates.push({
      id: 'pattern_locked',
      title: isBasque ? 'Eredu bat isolatuta' : 'Patrón localizado',
      detail: isBasque ? 'Orain errazagoa da hori ixtea.' : 'Ahora es mucho más fácil cerrarlo bien.',
    });
  }
  if (ctx.reducedPending) {
    candidates.push({
      id: 'pending_reduced',
      title: isBasque ? 'Zintzilik zegoena arintzen' : 'Pendiente reducido',
      detail: isBasque ? 'Gutxiago arrastatzen duzu hemendik aurrera.' : 'A partir de aquí arrastras menos.',
    });
  }
  if (ctx.sessionState === 'pressure_instability' || ctx.trainedPressure) {
    candidates.push({
      id: 'pressure_exposure',
      title: isBasque ? 'Presiopean esposizioa' : 'Exposición bajo exigencia',
      detail: isBasque ? 'Hau da mailari eustea eraikitzen duena.' : 'Esto es lo que entrena sostener el nivel.',
    });
  }
  if (ctx.sessionState === 'momentum_up') {
    candidates.push({
      id: 'level_up',
      title: isBasque ? 'Mailari eusten' : 'Subiendo nivel',
      detail: isBasque ? 'Orain jarraitutasuna da giltza.' : 'Ahora la clave es repetirlo con orden.',
    });
  }

  const reward = candidates[0] ?? null;
  if (!reward) return null;
  writeLastReward({ id: reward.id, timestamp: new Date().toISOString() });
  return reward;
};
