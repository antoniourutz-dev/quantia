import { useEffect, useMemo, useState } from 'react';
import type { QuestionFrictionItem } from '../domain/questionFriction/questionFrictionTypes';
import { getUserQuestionFriction } from '../services/questionFrictionApi';

export const useQuestionFriction = (params: {
  userId: string | null;
  curriculum: string;
  limit?: number;
  enabled?: boolean;
}) => {
  const { userId, curriculum, limit = 20, enabled = true } = params;
  const [data, setData] = useState<QuestionFrictionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldLoad = enabled && Boolean(userId) && Boolean(curriculum.trim());

  useEffect(() => {
    if (!shouldLoad) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void getUserQuestionFriction(String(userId), curriculum, limit)
      .then((rows) => {
        if (cancelled) return;
        setData(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'No se ha podido cargar friccion por pregunta.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [curriculum, limit, shouldLoad, userId]);

  const mapByQuestionId = useMemo(() => {
    const map: Record<string, QuestionFrictionItem> = {};
    for (const item of data) map[item.questionId] = item;
    return map;
  }, [data]);

  return { data, mapByQuestionId, loading, error };
};

