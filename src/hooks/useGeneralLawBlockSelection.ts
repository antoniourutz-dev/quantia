import { useCallback, useEffect, useMemo, useState } from 'react';
import { flattenBlocks, type BlockGroup } from '../utils/groupGeneralLawBlocks';

const STORAGE_PREFIX = 'generalLawBlockSelection';

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

export const useGeneralLawBlockSelection = ({
  userId,
  generalLawId,
  selectedBlockIds,
  groups,
  onSelectBlockIds,
  onClearBlockIds,
  onSelectAll,
  onClearAll,
}: {
  userId?: string | null;
  generalLawId?: string | null;
  selectedBlockIds: string[];
  groups: BlockGroup[];
  onSelectBlockIds?: (blockIds: string[]) => void;
  onClearBlockIds?: (blockIds: string[]) => void;
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
      window.localStorage.setItem(storageKey, JSON.stringify({ selectedBlockIds, expandedGroupKeys }));
    } catch {
      // Optional convenience state.
    }
  }, [expandedGroupKeys, selectedBlockIds, storageKey]);

  const selectedSet = useMemo(() => new Set(selectedBlockIds), [selectedBlockIds]);
  const allGroups = useMemo(() => {
    const map = new Map<string, BlockGroup>();
    const visit = (group: BlockGroup) => {
      map.set(group.key, group);
      group.children?.forEach(visit);
    };
    groups.forEach(visit);
    return map;
  }, [groups]);

  const getGroupSelectableBlockIds = useCallback(
    (groupKey: string) => {
      const group = allGroups.get(groupKey);
      return group ? flattenBlocks(group).filter((block) => (block.questionCount ?? 0) > 0).map((block) => block.id) : [];
    },
    [allGroups],
  );

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroupKeys((current) =>
      current.includes(groupKey) ? current.filter((key) => key !== groupKey) : [...current, groupKey],
    );
  }, []);

  const selectGroup = useCallback(
    (groupKey: string) => onSelectBlockIds?.(getGroupSelectableBlockIds(groupKey)),
    [getGroupSelectableBlockIds, onSelectBlockIds],
  );

  const clearGroup = useCallback(
    (groupKey: string) => onClearBlockIds?.(getGroupSelectableBlockIds(groupKey)),
    [getGroupSelectableBlockIds, onClearBlockIds],
  );

  const isGroupFullySelected = useCallback(
    (groupKey: string) => {
      const ids = getGroupSelectableBlockIds(groupKey);
      return ids.length > 0 && ids.every((id) => selectedSet.has(id));
    },
    [getGroupSelectableBlockIds, selectedSet],
  );

  const isGroupPartiallySelected = useCallback(
    (groupKey: string) => {
      const ids = getGroupSelectableBlockIds(groupKey);
      return ids.some((id) => selectedSet.has(id)) && !ids.every((id) => selectedSet.has(id));
    },
    [getGroupSelectableBlockIds, selectedSet],
  );

  return {
    expandedGroupKeys,
    toggleGroup,
    selectGroup,
    clearGroup,
    selectAllBlocks: onSelectAll,
    clearAllBlocks: onClearAll,
    isGroupFullySelected,
    isGroupPartiallySelected,
  };
};
