import { DOCUMENT_KIND_ORDER, type StudyDocumentKind } from './types';

/**
 * Dirección del lector en la barra del navegador: `#temario/28/manual?ancla=…&nota=…`.
 * Así el botón Atrás del móvil cierra el tema y se puede enlazar un tema, un apartado o un subrayado.
 */
export interface StudyRoute {
  topicNumber: number;
  kind: StudyDocumentKind;
  anchor: string | null;
  annotationId: string | null;
}

const PREFIX = '#temario/';

export const formatStudyHash = (route: StudyRoute) => {
  const params = new URLSearchParams();
  if (route.anchor) params.set('ancla', route.anchor);
  if (route.annotationId) params.set('nota', route.annotationId);
  const query = params.toString();
  return `${PREFIX}${route.topicNumber}/${route.kind}${query ? `?${query}` : ''}`;
};

export const parseStudyHash = (hash: string | null | undefined): StudyRoute | null => {
  const value = hash ?? '';
  if (!value.startsWith(PREFIX)) return null;
  const [path, query = ''] = value.slice(PREFIX.length).split('?');
  const [numberPart, kindPart] = path.split('/');
  const topicNumber = Number(numberPart);
  if (!Number.isInteger(topicNumber) || topicNumber <= 0) return null;
  const kind = (DOCUMENT_KIND_ORDER as string[]).includes(kindPart ?? '') ? (kindPart as StudyDocumentKind) : 'manual';
  const params = new URLSearchParams(query);
  return { topicNumber, kind, anchor: params.get('ancla'), annotationId: params.get('nota') };
};

export const isStudyHash = (hash: string | null | undefined) => (hash ?? '').startsWith(PREFIX);

/** Abre un punto del temario desde cualquier pantalla (por ejemplo, «Mis notas y subrayados»). */
export const openStudyRoute = (route: StudyRoute) => {
  window.location.hash = formatStudyHash(route).slice(1);
};
