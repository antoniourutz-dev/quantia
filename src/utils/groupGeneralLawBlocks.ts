import type { GeneralLawBlock } from '../types';
import type { GeneralLawArticle } from '../types/generalLawTraining';

export type BlockGroup = {
  key: string;
  label: string;
  blocks: GeneralLawBlock[];
  children?: BlockGroup[];
  totalBlocks: number;
  totalQuestions: number;
  selectedBlocks: number;
};

const cleanLabel = (value: string | null | undefined, fallback: string) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return fallback;
  return trimmed;
};

const cleanKey = (parts: Array<string | null | undefined>) =>
  parts.map((part) => cleanLabel(part, 'sin-dato').toLowerCase().replace(/\s+/g, '-')).join(':');

export const flattenBlocks = (group: BlockGroup): GeneralLawBlock[] => [
  ...group.blocks,
  ...(group.children?.flatMap((child) => flattenBlocks(child)) ?? []),
];

const summarizeGroup = (group: Pick<BlockGroup, 'blocks' | 'children'>, selectedIds: Set<string>) => {
  const blocks = [...group.blocks, ...(group.children?.flatMap((child) => flattenBlocks(child)) ?? [])];
  const blocksWithQuestions = blocks.filter((block) => (block.questionCount ?? 0) > 0);
  return {
    totalBlocks: blocks.length,
    totalQuestions: blocks.reduce((sum, block) => sum + (block.questionCount ?? 0), 0),
    selectedBlocks: blocksWithQuestions.filter((block) => selectedIds.has(block.id)).length,
  };
};

const createLeafGroup = (
  key: string,
  label: string,
  blocks: GeneralLawBlock[],
  selectedIds: Set<string>,
): BlockGroup => ({
  key,
  label,
  blocks,
  totalBlocks: blocks.length,
  totalQuestions: blocks.reduce((sum, block) => sum + (block.questionCount ?? 0), 0),
  selectedBlocks: blocks.filter((block) => (block.questionCount ?? 0) > 0 && selectedIds.has(block.id)).length,
});

const getArticleStructureByBlock = (articles: GeneralLawArticle[]) => {
  const map = new Map<string, GeneralLawArticle>();
  for (const article of articles) {
    const blockId = (article as GeneralLawArticle & { general_law_block_id?: string | null }).general_law_block_id;
    if (!blockId || map.has(blockId)) continue;
    map.set(blockId, article);
  }
  return map;
};

const getBlockTitleLabel = (block: GeneralLawBlock, article?: GeneralLawArticle) =>
  cleanLabel(block.titleLabel ?? block.title_label ?? article?.title_label, 'Sin título asignado');

const getBlockTitleKey = (block: GeneralLawBlock, titleLabel: string, article?: GeneralLawArticle) =>
  cleanKey([block.titleKey ?? block.title_key ?? article?.title_key, titleLabel]);

const getBlockChapterLabel = (block: GeneralLawBlock, article?: GeneralLawArticle) =>
  cleanLabel(block.chapterLabel ?? block.chapter_label ?? article?.chapter_label, 'Sin capítulo');

const getBlockChapterKey = (titleKey: string, block: GeneralLawBlock, chapterLabel: string, article?: GeneralLawArticle) =>
  cleanKey([titleKey, block.chapterKey ?? block.chapter_key ?? article?.chapter_key, chapterLabel]);

export const groupGeneralLawBlocks = (
  blocks: GeneralLawBlock[],
  selectedBlockIds: string[] = [],
  articles: GeneralLawArticle[] = [],
): BlockGroup[] => {
  const selectedIds = new Set(selectedBlockIds);
  const articlesByBlock = getArticleStructureByBlock(articles);
  const titleMap = new Map<string, GeneralLawBlock[]>();

  for (const block of blocks) {
    const article = articlesByBlock.get(block.id);
    const titleLabel = getBlockTitleLabel(block, article);
    const titleKey = getBlockTitleKey(block, titleLabel, article);
    titleMap.set(titleKey, [...(titleMap.get(titleKey) ?? []), block]);
  }

  return Array.from(titleMap.entries()).map(([titleKey, titleBlocks]) => {
    const firstBlock = titleBlocks[0];
    if (!firstBlock) return null;
    const firstArticle = articlesByBlock.get(firstBlock.id);
    const titleLabel = getBlockTitleLabel(firstBlock, firstArticle);
    const chapterMap = new Map<string, GeneralLawBlock[]>();

    for (const block of titleBlocks) {
      const article = articlesByBlock.get(block.id);
      const chapterLabel = getBlockChapterLabel(block, article);
      const chapterKey = getBlockChapterKey(titleKey, block, chapterLabel, article);
      chapterMap.set(chapterKey, [...(chapterMap.get(chapterKey) ?? []), block]);
    }

    const chapters = Array.from(chapterMap.entries())
      .map(([chapterKey, chapterBlocks]) => {
        const firstChapterBlock = chapterBlocks[0];
        if (!firstChapterBlock) return null;
        return createLeafGroup(
          chapterKey,
          getBlockChapterLabel(firstChapterBlock, articlesByBlock.get(firstChapterBlock.id)),
          chapterBlocks,
          selectedIds,
        );
      })
      .filter((group): group is BlockGroup => Boolean(group));

    const group: BlockGroup = {
      key: titleKey,
      label: titleLabel,
      blocks: [],
      children: chapters,
      totalBlocks: 0,
      totalQuestions: 0,
      selectedBlocks: 0,
    };
    return { ...group, ...summarizeGroup(group, selectedIds) };
  }).filter((group): group is BlockGroup => Boolean(group));
};
