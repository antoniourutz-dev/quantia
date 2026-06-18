import { useCallback, useEffect, useMemo, useState } from 'react';
import { flattenArticles, type ArticleGroup } from '../utils/groupGeneralLawArticles';

const STORAGE_PREFIX = 'generalLawArticleSelection';

const buildStorageKey = (userId: string | null | undefined, generalLawId: string) =>
  `${STORAGE_PREFIX}:${String(userId ?? 'anonymous').trim() || 'anonymous'}:${generalLawId}`;

const readStoredExpandedGroups = (key: string | null) => {
  if (!key) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const expandedGroupKeys = (parsed as { expandedGroupKeys?: unknown }).expandedGroupKeys;
    return Array.isArray(expandedGroupKeys)
      ? expandedGroupKeys.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

export const useGeneralLawArticleSelection = ({
  userId,
  generalLawId,
  selectedArticleIds,
  groups,
  onSelectArticleIds,
  onClearArticleIds,
  onSelectAll,
  onClearAll,
}: {
  userId?: string | null;
  generalLawId?: string | null;
  selectedArticleIds: string[];
  groups: ArticleGroup[];
  onSelectArticleIds?: (articleIds: string[]) => void;
  onClearArticleIds?: (articleIds: string[]) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
}) => {
  const storageKey = useMemo(
    () => (generalLawId ? buildStorageKey(userId, generalLawId) : null),
    [generalLawId, userId],
  );
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[]>([]);

  useEffect(() => {
    setExpandedGroupKeys(readStoredExpandedGroups(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          selectedArticleIds,
          expandedGroupKeys,
        }),
      );
    } catch {
      // Persisting expanded cards is optional.
    }
  }, [expandedGroupKeys, selectedArticleIds, storageKey]);

  const selectedSet = useMemo(() => new Set(selectedArticleIds), [selectedArticleIds]);
  const allGroups = useMemo(() => {
    const map = new Map<string, ArticleGroup>();
    const visit = (group: ArticleGroup) => {
      map.set(group.key, group);
      group.children?.forEach(visit);
    };
    groups.forEach(visit);
    return map;
  }, [groups]);

  const getGroupArticleIds = useCallback(
    (groupKey: string) => {
      const group = allGroups.get(groupKey);
      return group ? flattenArticles(group).map((article) => article.id) : [];
    },
    [allGroups],
  );

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroupKeys((current) =>
      current.includes(groupKey) ? current.filter((key) => key !== groupKey) : [...current, groupKey],
    );
  }, []);

  const selectGroup = useCallback(
    (groupKey: string) => {
      onSelectArticleIds?.(getGroupArticleIds(groupKey));
    },
    [getGroupArticleIds, onSelectArticleIds],
  );

  const clearGroup = useCallback(
    (groupKey: string) => {
      onClearArticleIds?.(getGroupArticleIds(groupKey));
    },
    [getGroupArticleIds, onClearArticleIds],
  );

  const isGroupFullySelected = useCallback(
    (groupKey: string) => {
      const ids = getGroupArticleIds(groupKey);
      return ids.length > 0 && ids.every((id) => selectedSet.has(id));
    },
    [getGroupArticleIds, selectedSet],
  );

  const isGroupPartiallySelected = useCallback(
    (groupKey: string) => {
      const ids = getGroupArticleIds(groupKey);
      return ids.some((id) => selectedSet.has(id)) && !ids.every((id) => selectedSet.has(id));
    },
    [getGroupArticleIds, selectedSet],
  );

  return {
    expandedGroupKeys,
    toggleGroup,
    selectGroup,
    clearGroup,
    selectAll: onSelectAll,
    clearAll: onClearAll,
    isGroupFullySelected,
    isGroupPartiallySelected,
  };
};
