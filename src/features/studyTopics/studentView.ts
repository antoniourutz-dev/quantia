import type { StudyDocumentKind } from './types';

/**
 * Vista del alumno: los textos aprobados llevan identificadores internos del equipo
 * (reglas `R001`, bloques `E01`, códigos de error `PLAZO`). Aquí se traducen, solo al
 * mostrarlos, a lo que entiende el alumno: el número del apartado del manual (con enlace),
 * «bloque 2» o el nombre del error típico. El texto guardado en Supabase no cambia.
 */

export interface StudentViewContext {
  topicCode: string;
  /** R001 → número del apartado («1.1») y ancla del manual. */
  rules: Map<string, { label: string; anchor: string }>;
  /** E01 → número del bloque («1»). */
  blocks: Map<string, string>;
  /** PLAZO → «Equivocar un plazo». */
  errors: Map<string, string>;
}

const RULE_ANCHOR = /<a id="(T\d{2}-E\d{2}-(R\d{3}))"><\/a>/g;
const BLOCK_GROUP = /\s*\((E\d{2}(?:\s*(?:y|–|-|,)\s*E\d{2})*)\)/g;
const FENCE = /^\s*(```|~~~)/;

const cleanHeadingTitle = (line: string) =>
  line
    .replace(/^#+\s+/, '')
    .replace(RULE_ANCHOR, '')
    .replace(/\s*`R\d{3}`/g, '')
    .replace(BLOCK_GROUP, '')
    .trim();

export const buildStudentViewContext = (
  topicCode: string,
  manualMd: string | null,
  erroresMd: string | null,
): StudentViewContext => {
  const rules = new Map<string, { label: string; anchor: string }>();
  const blocks = new Map<string, string>();
  const errors = new Map<string, string>();
  let inFence = false;
  for (const line of (manualMd ?? '').split('\n')) {
    if (FENCE.test(line)) inFence = !inFence;
    if (inFence || !/^#{2,4}\s/.test(line)) continue;
    const num = line.match(/^#+\s+(\d+(?:\.\d+)*)\.?\s/)?.[1] ?? null;
    const title = cleanHeadingTitle(line);
    for (const match of line.matchAll(RULE_ANCHOR)) {
      rules.set(match[2], { label: num ?? `«${title.replace(/^[^\p{L}\d]+/u, '')}»`, anchor: match[1] });
    }
    if (num && /^##\s/.test(line)) {
      for (const group of line.matchAll(BLOCK_GROUP)) {
        for (const code of group[1].match(/E\d{2}/g) ?? []) blocks.set(code, num);
      }
    }
  }
  for (const line of (erroresMd ?? '').split('\n')) {
    const match = line.match(/^##\s+<a id="([A-Z_]+)"><\/a>\1\s+·\s+(.+?)\s*$/);
    if (match) errors.set(match[1], match[2]);
  }
  return { topicCode, rules, blocks, errors };
};

const ruleHref = (ctx: StudentViewContext, kind: StudyDocumentKind, anchor: string) =>
  kind === 'manual' ? `#${anchor}` : `${ctx.topicCode}_manual.md#${anchor}`;

const errorHref = (ctx: StudentViewContext, kind: StudyDocumentKind, code: string) =>
  kind === 'errores' ? `#${code}` : `${ctx.topicCode}_errores.md#${code}`;

const TOKEN =
  /(\[[^\]\n]*\]\([^)\n]*\))|(`[^`\n]+`)|(<[^>\n]+>)|((?<![\w-])R\d{3}(?![\w]))|((?<![\w-])E\d{2}(?![\w]))/g;

/** Una línea de texto normal (prosa o tabla). */
const proseLine = (line: string, ctx: StudentViewContext, kind: StudyDocumentKind) =>
  line.replace(TOKEN, (whole, link: string, code: string, tag: string, rule: string, block: string) => {
    if (link) {
      return link.replace(/^\[([^\]]*)\]/, (_m, text: string) => {
        const replaced = text.replace(/(?<![\w-])R\d{3}(?!\w)/g, (r) => ctx.rules.get(r)?.label ?? r);
        return `[${replaced}]`;
      });
    }
    if (code) {
      const inner = code.slice(1, -1);
      const r = ctx.rules.get(inner);
      if (r) return `[${r.label}](${ruleHref(ctx, kind, r.anchor)})`;
      const name = ctx.errors.get(inner);
      if (name) return `[${name}](${errorHref(ctx, kind, inner)})`;
      if (inner === 'error_tipico') return 'error típico';
      return code;
    }
    if (tag) return tag;
    if (rule) {
      const r = ctx.rules.get(rule);
      return r ? `[${r.label}](${ruleHref(ctx, kind, r.anchor)})` : rule;
    }
    if (block) {
      const b = ctx.blocks.get(block);
      return b ? `bloque ${b}` : block;
    }
    return whole;
  });

/** Encabezados: sin enlaces nuevos, solo se quitan o traducen los códigos. */
const headingLine = (line: string, ctx: StudentViewContext) =>
  line
    .replace(/\s*`R\d{3}`/g, '')
    .replace(BLOCK_GROUP, '')
    .replace(/(<a id="([A-Z_]+)"><\/a>)\2\s+·\s+/, '$1')
    .replace(/Tabla `error_tipico → regla → ancla del manual`/, 'Dónde repasar cada error')
    .replace(/(?<![\w-])R\d{3}(?!\w)/g, (r) => ctx.rules.get(r)?.label ?? r)
    .replace(/(?<![\w-])E\d{2}(?!\w)/g, (b) => (ctx.blocks.has(b) ? `bloque ${ctx.blocks.get(b)}` : b));

/** Bloques de código (mapas del tema): se conserva el alineado en lo posible. */
const fenceLine = (line: string, ctx: StudentViewContext) =>
  line
    .replace(BLOCK_GROUP, '')
    .replace(/(?<![\w-])R\d{3}(?!\w)/g, (r) => {
      const label = ctx.rules.get(r)?.label;
      return label && !label.startsWith('«') ? label.padEnd(4) : r;
    })
    .replace(/(?<![\w-])E\d{2}(?!\w)/g, (b) => (ctx.blocks.has(b) ? `${ctx.blocks.get(b)}.`.padEnd(3) : b));

export const toStudentView = (md: string, ctx: StudentViewContext, kind: StudyDocumentKind): string => {
  const out: string[] = [];
  let inFence = false;
  let errorTable: 'none' | 'header' | 'rows' = 'none';
  for (const raw of md.split('\n')) {
    let line = raw;
    if (FENCE.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(fenceLine(line, ctx));
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      errorTable = 'none';
      out.push(headingLine(line, ctx));
      continue;
    }
    // Tabla final de Errores típicos: «error → reglas → anclas» pasa a «error → dónde repasarlo».
    if (/^\|[^|]+\|\s*Reglas[^|]*\|\s*Ancla[^|]*\|\s*$/.test(line)) {
      errorTable = 'header';
      out.push('| Error | Dónde repasarlo |');
      continue;
    }
    if (errorTable !== 'none') {
      if (!line.trim().startsWith('|')) errorTable = 'none';
      else if (errorTable === 'header') {
        errorTable = 'rows';
        out.push('|---|---|');
        continue;
      } else {
        const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
        line = `| ${cells[0]?.trim() ?? ''} | ${cells[1]?.trim() ?? ''} |`;
      }
    }
    if (kind === 'errores') line = rewriteUnusedErrors(line);
    if (kind === 'soluciones') {
      line = line.replace(/· Reglas: /, '· Repasa: ').replace(/· Error que evita: /, '· Error típico: ');
      // La respuesta empieza en la línea siguiente: salto de línea para que no se pegue a «Repasa».
      if (/^\*\*[\d.]+\*\* · Repasa: /.test(line)) line = `${line.trimEnd()}  `;
    }
    // Varias reglas pueden estar en el mismo apartado: «1.7, 1.7, 1.7» se queda en «1.7».
    out.push(proseLine(line, ctx, kind).replace(/(\[([^\]]+)\]\([^)\s]+\))(?:,\s*\[\2\]\([^)\s]+\))+/g, '$1'));
  }
  return out.join('\n');
};

/** Nombres de las fichas de error que un tema puede no usar (frase «En este tema no se usa `CUANTIA`»). */
const UNUSED_ERROR_NAMES: Record<string, string> = {
  COMPUTO: 'cómputo de plazos',
  CUANTIA: 'cuantías',
  PLAZO: 'plazos',
  ORGANO: 'órganos',
  REQUISITO: 'requisitos',
  EFECTO: 'efectos',
  EXCEPCION: 'excepciones',
  REGLA_GENERAL: 'reglas generales',
  TERMINO: 'términos',
};

/** «En este tema no se usan `COMPUTO` ni `CUANTIA`» → «En este tema no hay fichas de error de cómputo de plazos ni de cuantías». */
export const rewriteUnusedErrors = (line: string) =>
  line.replace(/En este tema no se usan? ((?:`[A-Z_]+`(?:,\s*|\s+(?:ni|y)\s+)?)+)/, (_m, list: string) => {
    const names = (list.match(/`[A-Z_]+`/g) ?? []).map((code) => {
      const key = code.slice(1, -1);
      return UNUSED_ERROR_NAMES[key] ?? key.toLowerCase().replace(/_/g, ' ');
    });
    const joined = names.length > 1 ? `${names.slice(0, -1).join(', de ')} ni de ${names[names.length - 1]}` : names[0];
    return `En este tema no hay fichas de error de ${joined}`;
  });

const EXERCISE_START = /^\*\*((?:\d+|S)\.\d+)\b[^*]*\*\*/;
const BLOCK_END = /^(#{1,6}\s|---\s*$)/;

/** Soluciones del solucionario (ya en vista de alumno) por número de ejercicio: «1.1», «S.2». */
export const splitSolutions = (solucionesMd: string): Map<string, string> => {
  const map = new Map<string, string>();
  let current: { id: string; lines: string[] } | null = null;
  const flush = () => {
    if (current) map.set(current.id, current.lines.join('\n').trim());
    current = null;
  };
  for (const line of solucionesMd.split('\n')) {
    const start = line.match(EXERCISE_START);
    if (start) {
      flush();
      const body = line
        .replace(/^\*\*S\.\d+\s*→\s*([a-d])\.?\*\*\s*/, '**Respuesta: $1.** ')
        .replace(/^\*\*[\d.S]+\*\*\s*·\s*/, '')
        .replace(/^\*\*[\d.S]+\.?\*\*\s*/, '');
      current = { id: start[1], lines: [body] };
      continue;
    }
    if (BLOCK_END.test(line)) {
      flush();
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();
  return map;
};

/**
 * Cuaderno con «Ver solución» debajo de cada ejercicio. Los bloques de la solución van dentro
 * de `<details>` y no reciben número de bloque, así que los subrayados del cuaderno no se mueven.
 */
export const attachSolutions = (cuadernoMd: string, solutions: Map<string, string>): string => {
  if (solutions.size === 0) return cuadernoMd;
  const out: string[] = [];
  let pending: string | null = null;
  const close = () => {
    if (!pending) return;
    const solution = solutions.get(pending);
    pending = null;
    if (!solution) return;
    while (out.length && out[out.length - 1].trim() === '') out.pop();
    out.push('', '<details class="sr-solution">', '<summary>Ver solución</summary>', '', solution, '', '</details>', '');
  };
  for (const line of cuadernoMd.split('\n')) {
    const start = line.match(EXERCISE_START);
    if (start || BLOCK_END.test(line)) close();
    if (start) pending = start[1];
    out.push(line);
  }
  close();
  return out.join('\n');
};

/** Códigos internos que quedan sin traducir (para comprobaciones). */
export const leftoverCodes = (md: string) => md.match(/(?<![\w#-])(?:R\d{3}|E\d{2})(?![\w])/g) ?? [];
