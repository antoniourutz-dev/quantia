import type { StudyProgress, StudyTopicSummary } from './types';

/**
 * Dos cosas distintas:
 * - «leído»: hasta dónde ha bajado el alumno (se guarda solo al desplazarse);
 * - «estudiado»: solo cuando el alumno pulsa «Marcar como estudiado».
 * El % de un tema pondera cada documento por sus palabras: el manual pesa más que el repaso.
 */
export interface DocState {
  read: number;
  done: boolean;
  updatedAt: string | null;
  completedAt: string | null;
}

export const docState = (row: StudyProgress | undefined, versionId: string | undefined): DocState => {
  if (!row || !versionId || row.versionId !== versionId)
    return { read: 0, done: false, updatedAt: null, completedAt: null };
  const done = Boolean(row.completedAt);
  return {
    read: done ? 1 : Math.max(0, Math.min(1, row.progress)),
    done,
    updatedAt: row.updatedAt || null,
    completedAt: row.completedAt,
  };
};

export interface TopicState {
  /** Fracción leída, ponderada por palabras. */
  read: number;
  /** Todos los documentos marcados como estudiados. */
  done: boolean;
  doneCount: number;
  started: boolean;
  totalWords: number;
  remainingWords: number;
  lastActivity: string | null;
  /** Fecha más antigua en que se marcó estudiado (si está entero). */
  completedAt: string | null;
}

export const topicState = (topic: StudyTopicSummary, progress: Record<string, StudyProgress>): TopicState => {
  let words = 0;
  let readWords = 0;
  let doneCount = 0;
  let lastActivity: string | null = null;
  let completedAt: string | null = null;
  for (const doc of topic.documents) {
    const w = Math.max(1, doc.current?.wordCount ?? 1);
    const state = docState(progress[doc.id], doc.current?.id);
    words += w;
    readWords += w * state.read;
    if (state.done) {
      doneCount += 1;
      if (!completedAt || (state.completedAt && state.completedAt < completedAt)) completedAt = state.completedAt;
    }
    if (state.updatedAt && (!lastActivity || state.updatedAt > lastActivity)) lastActivity = state.updatedAt;
  }
  const done = topic.documents.length > 0 && doneCount === topic.documents.length;
  return {
    read: words ? readWords / words : 0,
    done,
    doneCount,
    started: readWords > 0 || doneCount > 0,
    totalWords: words,
    remainingWords: Math.max(0, words - readWords),
    lastActivity,
    completedAt: done ? completedAt : null,
  };
};
