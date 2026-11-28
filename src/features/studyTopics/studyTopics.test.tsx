import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import MarkdownBody from './MarkdownBody';
import { applyMarks, blockText, clearMarks, findQuote, rangeToSpans, spansText } from './annotationDom';
import { readToc, resolveStudyLink } from './markdown';
import { mapTopicRows, pickCurrentVersion } from './studyTopicsApi';

const SAMPLE = [
  '> **Enunciado literal:** «21. El documento administrativo».',
  '',
  '## <a id="T21-E01-R001"></a>1.1 Concepto `R001`',
  '',
  'Los documentos públicos administrativos se emiten **por escrito**, a través de medios electrónicos.',
  '',
  '- Primer punto con **negrita** y texto.',
  '  - Subpunto anidado.',
  '- Segundo punto.',
  '',
  '| Qué | Plazo |',
  '|---|---|',
  '| Copia auténtica | **Quince días** |',
  '',
  'Ver [R001](GV-ADM-C1-2026-T21_manual.md#T21-E01-R001) y la [fuente](https://www.boe.es/x).',
  '',
  '<script>alert(1)</script><img src=x onerror=alert(1)>',
].join('\n');

const renderSample = () => {
  const { container } = render(
    <article>
      <MarkdownBody body={SAMPLE} />
    </article>,
  );
  return container.querySelector('article') as HTMLElement;
};

describe('MarkdownBody', () => {
  it('moves the material anchors onto headings and numbers every block', () => {
    const root = renderSample();
    const heading = root.querySelector('h2');
    expect(heading?.id).toBe('T21-E01-R001');
    expect(heading?.querySelector('a')).toBeNull();
    expect(root.querySelectorAll('[data-b]').length).toBeGreaterThan(6);
    expect(readToc(root)).toEqual([{ id: 'T21-E01-R001', level: 2, text: '1.1 Concepto R001' }]);
  });

  it('strips any other raw HTML', () => {
    const root = renderSample();
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.innerHTML).not.toContain('onerror');
  });

  it('opens external links in a new tab and marks internal ones', () => {
    const root = renderSample();
    const external = root.querySelector('a[href^="https://"]');
    expect(external?.getAttribute('target')).toBe('_blank');
    expect(external?.getAttribute('rel')).toContain('noopener');
    expect(root.querySelector('a[data-study-link]')?.getAttribute('href')).toBe(
      'GV-ADM-C1-2026-T21_manual.md#T21-E01-R001',
    );
  });
});

describe('resolveStudyLink', () => {
  it('understands anchors, sibling documents and external links', () => {
    expect(resolveStudyLink('#T21-E01-R001')).toEqual({
      type: 'anchor',
      anchor: 'T21-E01-R001',
    });
    expect(resolveStudyLink('GV-ADM-C1-2026-T21_soluciones.md')).toEqual({
      type: 'document',
      code: 'GV-ADM-C1-2026-T21',
      kind: 'soluciones',
      anchor: null,
    });
    expect(resolveStudyLink('https://boe.es')).toEqual({
      type: 'external',
      href: 'https://boe.es',
    });
    expect(resolveStudyLink('../../alcances/x.md')).toEqual({ type: 'none' });
    expect(resolveStudyLink('GV-ADM-C1-2026-T21_README.md')).toEqual({
      type: 'none',
    });
  });
});

describe('annotation anchoring', () => {
  it('turns a selection into block spans and paints it back exactly', () => {
    const root = renderSample();
    const paragraph = Array.from(root.querySelectorAll('p')).find((p) =>
      p.textContent?.startsWith('Los documentos'),
    ) as HTMLElement;
    const strong = paragraph.querySelector('strong') as HTMLElement;
    const range = document.createRange();
    range.setStart(paragraph.firstChild as Text, 4);
    range.setEnd(strong.firstChild as Text, 3);
    const spans = rangeToSpans(root, range);
    expect(spans).toHaveLength(1);
    expect(spansText(root, spans)).toBe('documentos públicos administrativos se emiten por');

    const before = paragraph.textContent;
    applyMarks(root, [{ id: 'a1', spans, className: 'sr-hl-yellow' }]);
    const marks = root.querySelectorAll('mark[data-ann="a1"]');
    expect(marks.length).toBe(2);
    expect(
      Array.from(marks)
        .map((m) => m.textContent)
        .join(''),
    ).toBe('documentos públicos administrativos se emiten por');
    expect(paragraph.textContent).toBe(before);

    clearMarks(root);
    expect(root.querySelector('mark')).toBeNull();
    expect(paragraph.textContent).toBe(before);
    expect(blockText(paragraph)).toBe(before);
  });

  it('keeps nested list items as separate blocks', () => {
    const root = renderSample();
    const items = Array.from(root.querySelectorAll('li'));
    const outer = items[0] as HTMLElement;
    expect(blockText(outer).trim()).toBe('Primer punto con negrita y texto.');
    const range = document.createRange();
    range.setStart(outer.firstChild as Text, 0);
    range.setEnd(items[1].firstChild as Text, 3);
    const spans = rangeToSpans(root, range);
    expect(spans.map((s) => s.b)).toEqual([outer.dataset.b, items[1].getAttribute('data-b')]);
  });

  it('re-anchors a quote from an older version', () => {
    const root = renderSample();
    const spans = findQuote(root, 'Quince días', null);
    expect(spansText(root, spans)).toBe('Quince días');
    expect(findQuote(root, 'texto que ya no existe', null)).toEqual([]);
  });
});

describe('topic mapping', () => {
  it('prefers the published version and falls back to the newest draft', () => {
    const v = (id: string, version: string, status: 'draft' | 'published' | 'retired') => ({
      id,
      version,
      versionDate: null,
      status,
      wordCount: 1,
      normativeNote: null,
      sourcesNote: null,
    });
    expect(pickCurrentVersion([v('a', '1.0', 'retired'), v('b', '1.1', 'published'), v('c', '1.2', 'draft')])?.id).toBe(
      'b',
    );
    expect(pickCurrentVersion([v('a', '1.1', 'draft'), v('c', '1.10', 'draft')])?.id).toBe('c');
    expect(pickCurrentVersion([v('a', '1.0', 'retired')])).toBeNull();
  });

  it('orders topics and documents', () => {
    const topics = mapTopicRows([
      {
        id: 't2',
        code: 'X-T02',
        topic_number: 2,
        title: 'Dos',
        status: 'draft',
        study_documents: [
          {
            id: 'd2',
            kind: 'repaso',
            title: 'Repaso',
            sort_order: 2,
            study_document_versions: [{ id: 'v2', version: '1.0', status: 'draft', word_count: 3 }],
          },
          {
            id: 'd1',
            kind: 'manual',
            title: 'Manual',
            sort_order: 1,
            study_document_versions: [{ id: 'v1', version: '1.0', status: 'draft', word_count: 3 }],
          },
        ],
      },
      {
        id: 't1',
        code: 'X-T01',
        topic_number: 1,
        title: 'Uno',
        status: 'draft',
        study_documents: [],
      },
    ]);
    expect(topics.map((t) => t.code)).toEqual(['X-T02']);
    expect(topics[0].documents.map((d) => d.kind)).toEqual(['manual', 'repaso']);
  });
});
