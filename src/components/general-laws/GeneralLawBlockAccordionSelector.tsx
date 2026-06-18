import { useEffect, useMemo, useRef } from 'react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import type { GeneralLawBlock } from '../../types';
import type { GeneralLawArticle } from '../../types/generalLawTraining';
import { useGeneralLawBlockSelection } from '../../hooks/useGeneralLawBlockSelection';
import { flattenBlocks, groupGeneralLawBlocks, type BlockGroup } from '../../utils/groupGeneralLawBlocks';

type BlockAccordionCopy = {
  chooseBlocks: string;
  loadingBlocks: string;
  noBlocks: string;
  selected: string;
  questions: string;
  selectAll: string;
  clear: string;
  pending: string;
  selectedSummary: (selected: number, total: number, questions: number) => string;
};

export default function GeneralLawBlockAccordionSelector({
  userId,
  generalLawId,
  blocks,
  articles,
  selectedBlockIds,
  loading,
  copy,
  onToggleBlock,
  onSelectAllBlocks,
  onClearBlocks,
  onSelectBlockGroup,
  onClearBlockGroup,
}: {
  userId?: string | null;
  generalLawId?: string | null;
  blocks: GeneralLawBlock[];
  articles: GeneralLawArticle[];
  selectedBlockIds: string[];
  loading: boolean;
  copy: BlockAccordionCopy;
  onToggleBlock?: (blockId: string) => void;
  onSelectAllBlocks?: () => void;
  onClearBlocks?: () => void;
  onSelectBlockGroup?: (blockIds: string[]) => void;
  onClearBlockGroup?: (blockIds: string[]) => void;
}) {
  const groups = useMemo(
    () => groupGeneralLawBlocks(blocks, selectedBlockIds, articles),
    [articles, blocks, selectedBlockIds],
  );
  const selectedQuestions = useMemo(
    () =>
      blocks
        .filter((block) => selectedBlockIds.includes(block.id))
        .reduce((sum, block) => sum + (block.questionCount ?? 0), 0),
    [blocks, selectedBlockIds],
  );
  const totalBlocksWithQuestions = blocks.filter((block) => (block.questionCount ?? 0) > 0).length;
  const selectedBlocksWithQuestions = blocks.filter(
    (block) => (block.questionCount ?? 0) > 0 && selectedBlockIds.includes(block.id),
  ).length;
  const blockSelection = useGeneralLawBlockSelection({
    userId,
    generalLawId,
    selectedBlockIds,
    groups,
    onSelectBlockIds: onSelectBlockGroup,
    onClearBlockIds: onClearBlockGroup,
    onSelectAll: onSelectAllBlocks,
    onClearAll: onClearBlocks,
  });

  return (
    <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{copy.chooseBlocks}</div>
          <div className="mt-1 text-xs font-bold text-slate-500">
            {loading
              ? copy.loadingBlocks
              : copy.selectedSummary(selectedBlocksWithQuestions, totalBlocksWithQuestions, selectedQuestions)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={blockSelection.selectAllBlocks}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-white"
          >
            {copy.selectAll}
          </button>
          <button
            type="button"
            onClick={blockSelection.clearAllBlocks}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-white"
          >
            {copy.clear}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {groups.map((group) => (
          <GeneralLawBlockTitleGroup
            key={group.key}
            group={group}
            selectedBlockIds={selectedBlockIds}
            expanded={blockSelection.expandedGroupKeys.includes(group.key)}
            fullySelected={blockSelection.isGroupFullySelected(group.key)}
            partiallySelected={blockSelection.isGroupPartiallySelected(group.key)}
            copy={copy}
            onToggleGroup={() => blockSelection.toggleGroup(group.key)}
            onSelectGroup={() => blockSelection.selectGroup(group.key)}
            onClearGroup={() => blockSelection.clearGroup(group.key)}
            onToggleBlock={onToggleBlock}
          />
        ))}
      </div>

      {!loading && blocks.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {copy.noBlocks}
        </div>
      ) : null}
    </div>
  );
}

function GeneralLawBlockTitleGroup({
  group,
  selectedBlockIds,
  expanded,
  fullySelected,
  partiallySelected,
  copy,
  onToggleGroup,
  onSelectGroup,
  onClearGroup,
  onToggleBlock,
}: {
  group: BlockGroup;
  selectedBlockIds: string[];
  expanded: boolean;
  fullySelected: boolean;
  partiallySelected: boolean;
  copy: BlockAccordionCopy;
  onToggleGroup: () => void;
  onSelectGroup: () => void;
  onClearGroup: () => void;
  onToggleBlock?: (blockId: string) => void;
}) {
  const contentId = `general-law-block-group-${group.key.replace(/[^a-z0-9_-]/gi, '-')}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={onToggleGroup}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="mt-0.5 rounded-full bg-white p-1 text-slate-500 shadow-sm">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <GroupSelectionIndicator checked={fullySelected} indeterminate={partiallySelected} />
          <span className="min-w-0">
            <span className="block text-sm font-black text-slate-900">{group.label}</span>
            <span className="mt-1 block text-xs font-bold text-slate-500">
              {group.totalBlocks} bloques · {group.totalQuestions} {copy.questions} · {group.selectedBlocks} {copy.selected}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 flex-wrap gap-2 pl-11 sm:pl-0">
          <button
            type="button"
            onClick={onSelectGroup}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 hover:text-indigo-700"
          >
            {copy.selectAll}
          </button>
          <button
            type="button"
            onClick={onClearGroup}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 hover:text-rose-700"
          >
            {copy.clear}
          </button>
        </div>
      </div>

      {expanded ? (
        <div id={contentId} className="space-y-3 border-t border-slate-100 bg-white px-3 py-3">
          {group.children?.map((child) => (
            <GeneralLawBlockChapterGroup
              key={child.key}
              group={child}
              selectedBlockIds={selectedBlockIds}
              copy={copy}
              onToggleBlock={onToggleBlock}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function GeneralLawBlockChapterGroup({
  group,
  selectedBlockIds,
  copy,
  onToggleBlock,
}: {
  group: BlockGroup;
  selectedBlockIds: string[];
  copy: BlockAccordionCopy;
  onToggleBlock?: (blockId: string) => void;
}) {
  const blocks = flattenBlocks(group);
  return (
    <section className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-black text-slate-700">{group.label}</div>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        {blocks.map((block) => (
          <GeneralLawBlockCard
            key={block.id}
            block={block}
            selected={selectedBlockIds.includes(block.id)}
            copy={copy}
            onToggleBlock={onToggleBlock}
          />
        ))}
      </div>
    </section>
  );
}

function GeneralLawBlockCard({
  block,
  selected,
  copy,
  onToggleBlock,
}: {
  block: GeneralLawBlock;
  selected: boolean;
  copy: BlockAccordionCopy;
  onToggleBlock?: (blockId: string) => void;
}) {
  const questionCount = block.questionCount ?? 0;
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 transition-all ${
        selected
          ? 'border-indigo-200 bg-indigo-50'
          : questionCount > 0
            ? 'border-slate-100 bg-white'
            : 'border-slate-100 bg-slate-50 opacity-60'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleBlock?.(block.id)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span className="min-w-0">
        <span className="block text-sm font-black text-slate-800">{block.title}</span>
        <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          {questionCount} {copy.questions}
          {questionCount === 0 ? ` · ${copy.pending}` : ''}
        </span>
      </span>
    </label>
  );
}

function GroupSelectionIndicator({
  checked,
  indeterminate,
}: {
  checked: boolean;
  indeterminate: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      readOnly
      tabIndex={-1}
      checked={checked}
      aria-hidden="true"
      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600"
    />
  );
}
