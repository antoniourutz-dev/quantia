import { defaultSchema } from 'rehype-sanitize';
import type { StudyDocumentKind } from './types';

/* Minimal hast typing to avoid extra type-only dependencies. */
type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
};

/** Raw HTML in the material is only `<a id="…"></a>` anchors inside headings. Everything else is stripped. */
export const sanitizeSchema = {
  ...defaultSchema,
  clobber: [],
  tagNames: (defaultSchema.tagNames ?? []).filter((tag) => tag !== 'img' && tag !== 'input'),
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), 'id'],
  },
};

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'th', 'td', 'pre']);
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/**
 * Gives every block a stable `data-b` (document order) and every heading an `id`:
 * the material's own anchor (`<a id>` moved onto the heading) or `h-N`.
 * Versions are immutable, so the same body always yields the same ids.
 */
export const rehypeStudyBlocks = () => (tree: HastNode) => {
  let blockIndex = 0;
  let headingIndex = 0;
  const visit = (node: HastNode) => {
    if (node.type === 'element' && node.tagName) {
      if (BLOCK_TAGS.has(node.tagName)) {
        blockIndex += 1;
        node.properties = {
          ...(node.properties ?? {}),
          dataB: `b${blockIndex}`,
        };
      }
      if (HEADING_TAGS.has(node.tagName)) {
        headingIndex += 1;
        const anchor = (node.children ?? []).find(
          (child) =>
            child.type === 'element' && child.tagName === 'a' && child.properties?.id && !(child.children ?? []).length,
        );
        if (anchor) {
          node.children = (node.children ?? []).filter((child) => child !== anchor);
          node.properties = {
            ...(node.properties ?? {}),
            id: String(anchor.properties?.id),
          };
        } else if (!node.properties?.id) {
          node.properties = {
            ...(node.properties ?? {}),
            id: `h-${headingIndex}`,
          };
        }
      }
    }
    (node.children ?? []).forEach(visit);
  };
  visit(tree);
};

export type StudyLinkTarget =
  | { type: 'anchor'; anchor: string }
  | {
      type: 'document';
      code: string;
      kind: StudyDocumentKind;
      anchor: string | null;
    }
  | { type: 'external'; href: string }
  | { type: 'none' };

const KINDS: StudyDocumentKind[] = ['manual', 'repaso', 'cuaderno', 'soluciones', 'errores'];

export const resolveStudyLink = (href: string | undefined | null): StudyLinkTarget => {
  const value = (href ?? '').trim();
  if (!value) return { type: 'none' };
  if (value.startsWith('#'))
    return value.length > 1 ? { type: 'anchor', anchor: decodeURIComponent(value.slice(1)) } : { type: 'none' };
  if (/^https?:\/\//i.test(value)) return { type: 'external', href: value };
  const match = value.match(/^(?:\.\/)?([A-Z0-9-]+-T\d{2})_([a-z]+)\.md(?:#(.+))?$/);
  if (match && KINDS.includes(match[2] as StudyDocumentKind)) {
    return {
      type: 'document',
      code: match[1],
      kind: match[2] as StudyDocumentKind,
      anchor: match[3] ? decodeURIComponent(match[3]) : null,
    };
  }
  return { type: 'none' };
};

export interface TocEntry {
  id: string;
  level: number;
  text: string;
}

export const readToc = (root: HTMLElement): TocEntry[] =>
  Array.from(root.querySelectorAll<HTMLElement>('h2[id], h3[id]')).map((heading) => ({
    id: heading.id,
    level: heading.tagName === 'H2' ? 2 : 3,
    text: (heading.textContent ?? '').trim(),
  }));
