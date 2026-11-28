import { useCallback, useEffect, useState } from 'react';
import type { TextHighlight } from '../components/HighlightableText';
import { createId } from '../lib/id';
import { getStudyData, saveStudyData, type StudyQuestionData } from '../lib/quantiaApi';

export type StudyAnnotationContentType = 'question' | 'explanation' | 'answer';

export interface StudyAnnotationMeta {
  contentType: StudyAnnotationContentType;
  answerIndex?: number | null;
  category?: string | null;
}

const buildKeyForMeta = (questionId: string, meta?: StudyAnnotationMeta): string => {
  if (!meta || meta.contentType === 'question') return questionId;
  if (meta.contentType === 'explanation') return `${questionId}_exp`;
  return `${questionId}_ans_${meta.answerIndex ?? 0}`;
};

export function useStudyAnnotations(params: {
  questionIds: string[];
  initialData?: StudyQuestionData | null;
  enabled?: boolean;
  localOnly?: boolean;
}) {
  const { questionIds, initialData = null, enabled = true, localOnly = false } = params;
  const [highlightsMap, setHighlightsMap] = useState<Record<string, TextHighlight[]>>(
    () => initialData?.highlights ?? {},
  );
  const [notesMap, setNotesMap] = useState<Record<string, string>>(
    () => initialData?.notes ?? {},
  );
  const [loading, setLoading] = useState(false);

  const idsSignature = questionIds.join('|');

  useEffect(() => {
    if (initialData) {
      setHighlightsMap((prev) => ({ ...prev, ...(initialData.highlights ?? {}) }));
      setNotesMap((prev) => ({ ...prev, ...(initialData.notes ?? {}) }));
    }
  }, [initialData]);

  useEffect(() => {
    const ids = idsSignature ? idsSignature.split('|') : [];
    if (!enabled || localOnly || ids.length === 0) return;
    let cancelled = false;
    setLoading(true);
    getStudyData(ids)
      .then((data) => {
        if (cancelled) return;
        setHighlightsMap((prev) => ({ ...prev, ...(data.highlights ?? {}) }));
        setNotesMap((prev) => ({ ...prev, ...(data.notes ?? {}) }));
      })
      .catch(() => {
        // Fallback to current state
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, idsSignature, localOnly]);

  const addHighlight = useCallback(
    async (
      questionId: string,
      highlight: Omit<TextHighlight, 'id'>,
      meta?: StudyAnnotationMeta,
    ) => {
      const key = buildKeyForMeta(questionId, meta);
      const spanId = `${highlight.startIndex}:${highlight.endIndex}:${highlight.type}`;
      let nextList: TextHighlight[] = [];
      setHighlightsMap((prev) => {
        const current = prev[key] ?? [];
        if (
          current.some(
            (item) =>
              item.startIndex === highlight.startIndex &&
              item.endIndex === highlight.endIndex &&
              item.type === highlight.type,
          )
        ) {
          nextList = current;
          return prev;
        }
        const created: TextHighlight = {
          ...highlight,
          id: spanId || createId(),
        };
        nextList = [...current, created];
        return { ...prev, [key]: nextList };
      });
      if (localOnly) return;
      await saveStudyData(
        key,
        { highlights: nextList },
        meta
          ? {
              contentType: meta.contentType,
              answerIndex: meta.answerIndex ?? null,
              category: meta.category ?? null,
              baseQuestionId: questionId,
            }
          : { baseQuestionId: questionId },
      );
    },
    [localOnly],
  );

  const removeHighlight = useCallback(
    async (questionId: string, highlightId: string, meta?: StudyAnnotationMeta) => {
      const key = buildKeyForMeta(questionId, meta);
      let nextList: TextHighlight[] = [];
      setHighlightsMap((prev) => {
        const current = prev[key] ?? [];
        nextList = current.filter((item) => item.id !== highlightId);
        return { ...prev, [key]: nextList };
      });
      if (localOnly) return;
      await saveStudyData(
        key,
        { highlights: nextList },
        meta
          ? {
              contentType: meta.contentType,
              answerIndex: meta.answerIndex ?? null,
              category: meta.category ?? null,
              baseQuestionId: questionId,
            }
          : { baseQuestionId: questionId },
      );
    },
    [localOnly],
  );

  const saveNote = useCallback(async (questionId: string, note: string) => {
    const trimmed = note.trim();
    setNotesMap((prev) => {
      const next = { ...prev };
      if (trimmed) {
        next[questionId] = note;
      } else {
        delete next[questionId];
      }
      return next;
    });
    if (!localOnly) await saveStudyData(questionId, { notes: trimmed ? note : '' });
  }, [localOnly]);

  return {
    highlightsMap,
    notesMap,
    loading,
    addHighlight,
    removeHighlight,
    saveNote,
  };
}
