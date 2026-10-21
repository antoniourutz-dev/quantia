type RandomCycleQuestion = { id: string; text: string };

type RandomCycleState = { fingerprint: string; remainingIds: string[] };

const fallbackCycleState = new Map<string, string>();

const shuffle = <T,>(values: T[]): T[] => {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[targetIndex]] = [shuffled[targetIndex], shuffled[index]];
  }
  return shuffled;
};

const normalizeVisibleText = (value: string) =>
  value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

const buildPoolFingerprint = (ids: string[]) => {
  let hash = 2166136261;
  const input = [...ids].sort().join('\u001f');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${ids.length}:${hash >>> 0}`;
};

const readStoredState = (storageKey: string): RandomCycleState | null => {
  try {
    const raw = typeof window === 'undefined'
      ? fallbackCycleState.get(storageKey) ?? null
      : window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RandomCycleState>;
    if (typeof parsed.fingerprint !== 'string' || !Array.isArray(parsed.remainingIds)) return null;
    return {
      fingerprint: parsed.fingerprint,
      remainingIds: parsed.remainingIds.filter((id): id is string => typeof id === 'string' && Boolean(id)),
    };
  } catch {
    return null;
  }
};

const writeStoredState = (storageKey: string, state: RandomCycleState) => {
  const serialized = JSON.stringify(state);
  try {
    if (typeof window === 'undefined') fallbackCycleState.set(storageKey, serialized);
    else window.localStorage.setItem(storageKey, serialized);
  } catch {
    fallbackCycleState.set(storageKey, serialized);
  }
};

const startNextCycle = (poolIds: string[], alreadySelected: Set<string>) => {
  const shuffled = shuffle(poolIds);
  if (alreadySelected.size === 0) return shuffled;
  return [
    ...shuffled.filter((id) => !alreadySelected.has(id)),
    ...shuffled.filter((id) => alreadySelected.has(id)),
  ];
};

export const selectQuestionsFromRandomCycle = <T extends RandomCycleQuestion>(params: {
  questions: T[];
  count: number;
  storageKey: string;
  historicallySeenIds?: Iterable<string>;
}): T[] => {
  const byId = new Map<string, T>();
  for (const question of params.questions) {
    const id = String(question.id ?? '').trim();
    if (id && !byId.has(id)) byId.set(id, question);
  }

  const pool = Array.from(byId.values());
  const targetSize = Math.min(pool.length, Math.max(0, Math.trunc(params.count)));
  if (targetSize === 0) return [];

  const poolIds = pool.map((question) => question.id);
  const validIds = new Set(poolIds);
  const historicallySeenIds = new Set(
    Array.from(params.historicallySeenIds ?? [])
      .map((id) => String(id ?? '').trim())
      .filter((id) => validIds.has(id)),
  );
  const historicalCoverageIsIncomplete = historicallySeenIds.size < poolIds.length;
  const idsToSkip = historicalCoverageIsIncomplete ? historicallySeenIds : new Set<string>();
  const fingerprint = buildPoolFingerprint(poolIds);
  const stored = readStoredState(params.storageKey);
  const storedIdsAreValid = Boolean(
    stored &&
      stored.fingerprint === fingerprint &&
      stored.remainingIds.every((id) => validIds.has(id)) &&
      new Set(stored.remainingIds).size === stored.remainingIds.length,
  );
  const unseenPoolIds = poolIds.filter((id) => !idsToSkip.has(id));
  const storedUnseenIds = storedIdsAreValid
    ? stored!.remainingIds.filter((id) => !idsToSkip.has(id))
    : [];
  const storedUnseenIdSet = new Set(storedUnseenIds);
  const selectedButNotViewedIds = unseenPoolIds.filter((id) => !storedUnseenIdSet.has(id));
  let remainingIds = historicalCoverageIsIncomplete
    ? [...storedUnseenIds, ...shuffle(selectedButNotViewedIds)]
    : storedIdsAreValid
      ? stored!.remainingIds
      : shuffle(poolIds);
  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const selectedVisibleTexts = new Set<string>();

  while (selected.length < targetSize) {
    if (remainingIds.length === 0) remainingIds = startNextCycle(poolIds, selectedIds);
    const distinctIndex = remainingIds.findIndex((id) => {
      const question = byId.get(id);
      return question && !selectedVisibleTexts.has(normalizeVisibleText(question.text));
    });
    const [id] = remainingIds.splice(distinctIndex >= 0 ? distinctIndex : 0, 1);
    const question = byId.get(id);
    if (!question || selectedIds.has(id)) continue;
    selected.push(question);
    selectedIds.add(id);
    selectedVisibleTexts.add(normalizeVisibleText(question.text));
  }

  writeStoredState(params.storageKey, { fingerprint, remainingIds });
  return selected;
};
