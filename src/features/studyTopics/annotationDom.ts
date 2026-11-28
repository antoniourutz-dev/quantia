import type { AnnotationSpan } from './types';

/**
 * Text anchoring for the reader. Every rendered block carries `data-b`. A block's own text is
 * made of the text nodes whose nearest `[data-b]` ancestor is that block, so nested blocks
 * (a list inside a list item) keep separate offsets. Offsets are UTF-16 indexes in that text.
 */

export const BLOCK_ATTR = 'data-b';
export const MARK_ATTR = 'data-ann';

const nearestBlock = (node: Node | null): HTMLElement | null => {
  let current: Node | null = node;
  while (current) {
    if (current.nodeType === 1 && (current as HTMLElement).hasAttribute(BLOCK_ATTR)) return current as HTMLElement;
    current = current.parentNode;
  }
  return null;
};

export const ownTextNodes = (block: HTMLElement): Text[] => {
  const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (nearestBlock(node) === block) nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
};

export const blockText = (block: HTMLElement) =>
  ownTextNodes(block)
    .map((n) => n.data)
    .join('');

/** Converts a DOM range inside `root` into per-block spans. Returns [] when nothing is selectable. */
export const rangeToSpans = (root: HTMLElement, range: Range): AnnotationSpan[] => {
  if (range.collapsed || !root.contains(range.commonAncestorContainer)) return [];
  const spans: AnnotationSpan[] = [];
  for (const block of Array.from(root.querySelectorAll<HTMLElement>(`[${BLOCK_ATTR}]`))) {
    if (!range.intersectsNode(block)) continue;
    let base = 0;
    let start = -1;
    let end = -1;
    for (const node of ownTextNodes(block)) {
      const length = node.data.length;
      if (range.intersectsNode(node)) {
        const s = node === range.startContainer ? range.startOffset : 0;
        const e = node === range.endContainer ? range.endOffset : length;
        if (e > s) {
          if (start < 0) start = base + s;
          end = base + e;
        }
      }
      base += length;
    }
    if (start >= 0 && end > start)
      spans.push({
        b: block.getAttribute(BLOCK_ATTR) as string,
        s: start,
        e: end,
      });
  }
  return spans;
};

export const spansText = (root: HTMLElement, spans: AnnotationSpan[]) =>
  spans
    .map((span) => {
      const block = root.querySelector<HTMLElement>(`[${BLOCK_ATTR}="${span.b}"]`);
      return block ? blockText(block).slice(span.s, span.e) : '';
    })
    .filter(Boolean)
    .join(' … ');

export const clearMarks = (root: HTMLElement) => {
  const marks = Array.from(root.querySelectorAll(`mark[${MARK_ATTR}]`));
  const parents = new Set<Node>();
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parents.add(parent);
  }
  parents.forEach((parent) => parent.normalize());
};

export interface MarkRequest {
  id: string;
  spans: AnnotationSpan[];
  className: string;
  title?: string;
}

/** Wraps each span in `<mark data-ann=id>`. Overlaps are allowed: later marks nest inside earlier ones. */
export const applyMarks = (root: HTMLElement, requests: MarkRequest[]) => {
  for (const request of requests) {
    for (const span of request.spans) {
      const block = root.querySelector<HTMLElement>(`[${BLOCK_ATTR}="${span.b}"]`);
      if (!block) continue;
      let position = 0;
      for (const node of ownTextNodes(block)) {
        const nodeStart = position;
        const nodeEnd = position + node.data.length;
        position = nodeEnd;
        const from = Math.max(span.s, nodeStart);
        const to = Math.min(span.e, nodeEnd);
        if (to <= from) continue;
        let target = node;
        if (from > nodeStart) target = target.splitText(from - nodeStart);
        if (to < nodeEnd) target.splitText(to - from);
        const mark = block.ownerDocument.createElement('mark');
        mark.setAttribute(MARK_ATTR, request.id);
        mark.className = request.className;
        if (request.title) mark.title = request.title;
        target.parentNode?.insertBefore(mark, target);
        mark.appendChild(target);
      }
    }
  }
};

/** Re-anchors a quote saved on an older version: first in its block, then anywhere in one block. */
export const findQuote = (root: HTMLElement, quote: string, preferredBlock: string | null): AnnotationSpan[] => {
  const needle = quote.split(' … ')[0]?.trim();
  if (!needle) return [];
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(`[${BLOCK_ATTR}]`));
  const ordered = preferredBlock
    ? [...blocks.filter((b) => b.getAttribute(BLOCK_ATTR) === preferredBlock), ...blocks]
    : blocks;
  for (const block of ordered) {
    const index = blockText(block).indexOf(needle);
    if (index >= 0)
      return [
        {
          b: block.getAttribute(BLOCK_ATTR) as string,
          s: index,
          e: index + needle.length,
        },
      ];
  }
  return [];
};
