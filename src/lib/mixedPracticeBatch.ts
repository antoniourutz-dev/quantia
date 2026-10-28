import type { Question, SyllabusType } from '../types';

type ScopeLoader = (scope: SyllabusType, count: number) => Promise<Question[]>;

const appendUnique = (target: Question[], questions: Question[]) => {
  const ids = new Set(target.map((question) => question.id));
  for (const question of questions) {
    if (ids.has(question.id)) continue;
    ids.add(question.id);
    target.push(question);
  }
};

const interleave = (common: Question[], specific: Question[], count: number) => {
  const result: Question[] = [];
  const first = Math.random() < 0.5 ? common : specific;
  const second = first === common ? specific : common;
  const maxLength = Math.max(first.length, second.length);
  for (let index = 0; index < maxLength && result.length < count; index += 1) {
    if (first[index]) result.push(first[index]);
    if (result.length < count && second[index]) result.push(second[index]);
  }
  return result;
};

export const getBalancedMixedPracticeBatch = async (params: {
  count: number;
  loadScope: ScopeLoader;
}): Promise<Question[]> => {
  const count = Math.max(0, Math.trunc(params.count));
  if (count === 0) return [];

  const commonTarget = Math.ceil(count / 2);
  const specificTarget = Math.floor(count / 2);
  const [commonInitial, specificInitial] = await Promise.all([
    params.loadScope('common', commonTarget),
    specificTarget > 0 ? params.loadScope('specific', specificTarget) : Promise.resolve([]),
  ]);
  const common = commonInitial.slice(0, commonTarget);
  const specific = specificInitial.slice(0, specificTarget);

  const missingCommon = commonTarget - common.length;
  const missingSpecific = specificTarget - specific.length;
  if (missingCommon > 0) {
    appendUnique(specific, await params.loadScope('specific', missingCommon + specific.length));
  }
  if (missingSpecific > 0) {
    appendUnique(common, await params.loadScope('common', missingSpecific + common.length));
  }

  return interleave(common, specific, count);
};
