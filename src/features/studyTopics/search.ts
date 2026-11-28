/** Búsqueda dentro de un tema: sin distinguir mayúsculas ni tildes. */

const foldChar = (ch: string) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Texto plegado y, para cada carácter plegado, su posición en el texto original. */
export const foldWithMap = (text: string) => {
  let folded = '';
  const map: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const f = foldChar(text[i]);
    for (let j = 0; j < f.length; j += 1) {
      folded += f[j];
      map.push(i);
    }
  }
  return { folded, map };
};

export const foldText = (text: string) => foldWithMap(text).folded;

/** Posiciones (en el texto original) de cada aparición de `query`. */
export const findInText = (text: string, query: string): Array<{ start: number; end: number }> => {
  const q = foldText(query.trim());
  if (q.length < 2) return [];
  const { folded, map } = foldWithMap(text);
  const out: Array<{ start: number; end: number }> = [];
  let from = 0;
  for (;;) {
    const i = folded.indexOf(q, from);
    if (i < 0) break;
    out.push({ start: map[i], end: map[i + q.length - 1] + 1 });
    from = i + q.length;
  }
  return out;
};

/** Markdown del temario → texto que ve el alumno (aprox.): sin enlaces, marcas ni tablas. */
export const markdownToPlainText = (md: string) =>
  md
    .replace(/<details[\s\S]*?<\/details>/g, ' ')
    .replace(/<[^>\n]+>/g, '')
    .replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[*_`]/g, '')
    .replace(/[ \t]+/g, ' ');

export const snippetAround = (text: string, start: number, end: number, radius = 60) => {
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  const clean = (value: string) => value.replace(/\s+/g, ' ');
  return {
    before: (from > 0 ? '…' : '') + clean(text.slice(from, start)).trimStart(),
    match: text.slice(start, end),
    after: clean(text.slice(end, to)).trimEnd() + (to < text.length ? '…' : ''),
  };
};
