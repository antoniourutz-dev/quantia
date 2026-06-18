import { useEffect, useState } from 'react';
import {
  getGeneralLawArticleQuestionCounts,
  getPublishedGeneralLawArticles,
} from '../repositories/generalLawRepository';
import type { GeneralLawArticle, GeneralLawArticleQuestionCountParams } from '../types/generalLawTraining';

export const useGeneralLawArticles = ({
  lawId,
  enabled,
  countParams,
}: {
  lawId: string | null;
  enabled: boolean;
  countParams: Omit<GeneralLawArticleQuestionCountParams, 'lawId'>;
}) => {
  const [articles, setArticles] = useState<GeneralLawArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !lawId) {
      setArticles([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getPublishedGeneralLawArticles(lawId)
      .then(async (publishedArticles) => {
        if (cancelled) return;
        try {
          const counts = await getGeneralLawArticleQuestionCounts({ ...countParams, lawId });
          if (cancelled) return;
          setArticles(
            publishedArticles.map((article) => {
              const count = counts.get(article.id);
              return {
                ...article,
                question_count: count?.questionCount ?? 0,
                primary_question_count: count?.primaryQuestionCount ?? 0,
              };
            }),
          );
        } catch {
          if (cancelled) return;
          setArticles(publishedArticles.map((article) => ({ ...article, question_count: 0, primary_question_count: 0 })));
        }
      })
      .catch((caught) => {
        if (cancelled) return;
        setArticles([]);
        setError(
          caught instanceof Error
            ? caught.message
            : 'No se han podido cargar los artículos publicados de la ley.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    countParams.curriculum,
    countParams.curriculumKey,
    countParams.grupo,
    countParams.oppositionId,
    countParams.questionScopeKey,
    enabled,
    lawId,
  ]);

  return { articles, loading, error };
};
