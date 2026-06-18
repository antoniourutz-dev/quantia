import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GeneralLawBlock } from '../types';
import type {
  GeneralLawArticle,
  GeneralLawSelectionMode,
  GeneralLawTrainingSelection,
} from '../types/generalLawTraining';

const STORAGE_PREFIX = 'generalLawSelection';

const buildStorageKey = (userId: string | null | undefined, curriculum: string, generalLawId: string) =>
  `${STORAGE_PREFIX}:${String(userId ?? 'anonymous').trim() || 'anonymous'}:${curriculum}:${generalLawId}`;

const uniqueKnownIds = (ids: unknown, knownIds: Set<string>) =>
  Array.isArray(ids)
    ? Array.from(new Set(ids.map((item) => String(item ?? '').trim()).filter((id) => knownIds.has(id))))
    : [];

const defaultBlockIds = (blocks: GeneralLawBlock[]) => {
  const withQuestions = blocks.filter((block) => (block.questionCount ?? 0) > 0).map((block) => block.id);
  return withQuestions;
};

const defaultArticleIds = (articles: GeneralLawArticle[]) =>
  articles.filter((article) => (article.question_count ?? 0) > 0).map((article) => article.id);

export const useGeneralLawTrainingSelection = ({
  userId,
  curriculum,
  generalLawId,
  blocks,
  articles,
  enabled,
}: {
  userId?: string | null;
  curriculum: string;
  generalLawId: string | null;
  blocks: GeneralLawBlock[];
  articles: GeneralLawArticle[];
  enabled: boolean;
}) => {
  const [selection, setSelection] = useState<GeneralLawTrainingSelection>({
    mode: 'blocks',
    generalLawId: generalLawId ?? '',
    selectedBlockIds: [],
    selectedArticleIds: [],
    selectedScopeId: null,
  });
  const [initialized, setInitialized] = useState(false);

  const storageKey = useMemo(
    () => (generalLawId ? buildStorageKey(userId, curriculum, generalLawId) : null),
    [curriculum, generalLawId, userId],
  );

  useEffect(() => {
    if (!enabled || !generalLawId) {
      setSelection({
        mode: 'blocks',
        generalLawId: '',
        selectedBlockIds: [],
        selectedArticleIds: [],
        selectedScopeId: null,
      });
      setInitialized(false);
      return;
    }

    const blockIds = new Set(blocks.map((block) => block.id));
    const articleIds = new Set(articles.map((article) => article.id));
    let parsed: Partial<GeneralLawTrainingSelection> | null = null;
    if (storageKey) {
      try {
        const raw = window.localStorage.getItem(storageKey);
        parsed = raw ? (JSON.parse(raw) as Partial<GeneralLawTrainingSelection>) : null;
      } catch {
        parsed = null;
      }
    }

    const mode: GeneralLawSelectionMode =
      parsed?.mode === 'articles' || parsed?.mode === 'official' || parsed?.mode === 'scope' || parsed?.mode === 'blocks'
        ? parsed.mode
        : 'blocks';

    setSelection({
      mode,
      generalLawId,
      selectedBlockIds: parsed ? uniqueKnownIds(parsed.selectedBlockIds, blockIds) : defaultBlockIds(blocks),
      selectedArticleIds: parsed ? uniqueKnownIds(parsed.selectedArticleIds, articleIds) : defaultArticleIds(articles),
      selectedScopeId: parsed?.selectedScopeId ?? null,
    });
    setInitialized(true);
  }, [articles, blocks, enabled, generalLawId, storageKey]);

  useEffect(() => {
    if (!initialized || !enabled || !storageKey || !selection.generalLawId) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(selection));
    } catch {
      // localStorage is a convenience; failing to persist must not block study.
    }
  }, [enabled, initialized, selection, storageKey]);

  const setMode = useCallback(
    (mode: GeneralLawSelectionMode) => {
      setSelection((current) => ({
        ...current,
        mode,
        selectedArticleIds:
          mode === 'articles' && current.selectedArticleIds.length === 0
            ? defaultArticleIds(articles)
            : current.selectedArticleIds,
        selectedBlockIds:
          mode === 'blocks' && current.selectedBlockIds.length === 0
            ? defaultBlockIds(blocks)
            : current.selectedBlockIds,
      }));
    },
    [articles, blocks],
  );

  const toggleBlock = useCallback((blockId: string) => {
    setSelection((current) => ({
      ...current,
      selectedBlockIds: current.selectedBlockIds.includes(blockId)
        ? current.selectedBlockIds.filter((id) => id !== blockId)
        : [...current.selectedBlockIds, blockId],
    }));
  }, []);

  const selectAllBlocks = useCallback(() => {
    setSelection((current) => ({ ...current, selectedBlockIds: defaultBlockIds(blocks) }));
  }, [blocks]);

  const clearBlocks = useCallback(() => {
    setSelection((current) => ({ ...current, selectedBlockIds: [] }));
  }, []);

  const selectOnlyBlock = useCallback((blockId: string) => {
    setSelection((current) => ({ ...current, selectedBlockIds: [blockId] }));
  }, []);

  const selectBlockIds = useCallback((blockIds: string[]) => {
    setSelection((current) => ({
      ...current,
      selectedBlockIds: Array.from(new Set([...current.selectedBlockIds, ...blockIds])),
    }));
  }, []);

  const clearBlockIds = useCallback((blockIds: string[]) => {
    const idsToClear = new Set(blockIds);
    setSelection((current) => ({
      ...current,
      selectedBlockIds: current.selectedBlockIds.filter((id) => !idsToClear.has(id)),
    }));
  }, []);

  const toggleArticle = useCallback((articleId: string) => {
    setSelection((current) => ({
      ...current,
      selectedArticleIds: current.selectedArticleIds.includes(articleId)
        ? current.selectedArticleIds.filter((id) => id !== articleId)
        : [...current.selectedArticleIds, articleId],
    }));
  }, []);

  const selectAllArticlesWithQuestions = useCallback(() => {
    setSelection((current) => ({ ...current, selectedArticleIds: defaultArticleIds(articles) }));
  }, [articles]);

  const clearArticles = useCallback(() => {
    setSelection((current) => ({ ...current, selectedArticleIds: [] }));
  }, []);

  const selectArticleIds = useCallback((articleIds: string[]) => {
    setSelection((current) => ({
      ...current,
      selectedArticleIds: Array.from(new Set([...current.selectedArticleIds, ...articleIds])),
    }));
  }, []);

  const clearArticleIds = useCallback((articleIds: string[]) => {
    const idsToClear = new Set(articleIds);
    setSelection((current) => ({
      ...current,
      selectedArticleIds: current.selectedArticleIds.filter((id) => !idsToClear.has(id)),
    }));
  }, []);

  return {
    selection,
    setMode,
    toggleBlock,
    selectAllBlocks,
    clearBlocks,
    selectOnlyBlock,
    selectBlockIds,
    clearBlockIds,
    toggleArticle,
    selectAllArticlesWithQuestions,
    clearArticles,
    selectArticleIds,
    clearArticleIds,
  };
};
