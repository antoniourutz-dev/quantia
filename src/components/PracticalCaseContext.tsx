import { useEffect, useRef, useState } from 'react';
import { getCaseAssets, getQuestionCase, type PracticalCase, type CaseAsset } from '../lib/practicalCases';
import PracticalCaseImage from './PracticalCaseImage';
import HighlightableText, { type TextHighlight } from './HighlightableText';
import { createId } from '../lib/id';

export default function PracticalCaseContext({ questionId, onStatusChange }: {
  questionId: string; onStatusChange?: (questionId: string, ready: boolean) => void;
}) {
  const [state, setState] = useState<{ questionId: string; loading: boolean; error: boolean; context: PracticalCase | null; assets: Array<CaseAsset & { url: string }> }>({questionId,loading:true,error:false,context:null,assets:[]});
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [image, setImage] = useState<(CaseAsset & { url: string }) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const section = useRef<HTMLElement>(null);
  const assetCache = useRef(new Map<string, Array<CaseAsset & { url: string }>>());
  // Drafts belong to this mounted test only, independently for each case.
  const [drafts, setDrafts] = useState<Record<string, { text: string; highlights: TextHighlight[] }>>({});
  useEffect(() => {
    let active = true;
    setState({questionId,loading:true,error:false,context:null,assets:[]});
    setExpanded(false); setImage(null);
    onStatusChange?.(questionId, false);
    void (async () => {
      try {
        const context = await getQuestionCase(questionId);
        const assets = context ? assetCache.current.get(context.id) ?? await getCaseAssets(context.id) : [];
        if (active && context) assetCache.current.set(context.id, assets);
        if (active) {
          setState({questionId,loading:false,error:false,context,assets});
          onStatusChange?.(questionId, true);
        }
      } catch {
        if (active) setState({questionId,loading:false,error:true,context:null,assets:[]});
      }
    })();
    return () => { active = false; };
  }, [questionId, attempt, onStatusChange]);
  useEffect(() => {
    if (image && dialog.current && !dialog.current.open) dialog.current.showModal();
    else if (!image && dialog.current?.open) dialog.current.close();
  }, [image]);
  if (state.questionId !== questionId || state.loading) return null;
  if (state.error) return <div role="alert" className="m-3 rounded-xl bg-amber-50 p-4 text-amber-900">No se ha podido comprobar el enunciado asociado. <button type="button" className="font-bold underline" onClick={() => setAttempt(v => v + 1)}>Reintentar</button></div>;
  if (!state.context) return null;
  const c = state.context;
  const statement = c.statement.split(/\n\s*\n/).map(paragraph => paragraph.replace(/\s+/g, ' ').trim()).join('\n\n');
  const highlights = drafts[c.id]?.text === statement ? drafts[c.id].highlights : [];
  return <section ref={section} aria-label="Enunciado del caso práctico" className="m-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 sm:mx-0">
    <button type="button" onClick={() => { setExpanded(true); section.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="fixed bottom-[calc(10rem+env(safe-area-inset-bottom))] right-3 z-40 rounded-full bg-indigo-700 px-4 py-3 text-sm font-bold text-white shadow-lg lg:hidden">Consultar caso</button>
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-t-2xl bg-indigo-50 p-4">
      <h2 className="font-bold text-indigo-950">Caso {c.case_number} · {c.title}</h2>
      <button type="button" aria-expanded={expanded} className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-indigo-700" onClick={() => setExpanded(v => !v)}>{expanded ? 'Reducir enunciado' : 'Leer enunciado completo'}</button>
    </div>
    <div className={`overflow-y-auto p-4 ${expanded ? 'max-h-[65dvh]' : 'max-h-56'}`} tabIndex={0} aria-label="Texto y recursos del caso">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{highlights.length ? 'Subrayado temporal · se borra al salir del test' : 'Selecciona texto para subrayar mientras analizas el caso.'}</span>
        {highlights.length > 0 && <button type="button" aria-label="Limpiar subrayado del enunciado" className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-bold text-slate-600" onClick={() => setDrafts(prev => ({ ...prev, [c.id]: { text: statement, highlights: [] } }))}>Limpiar</button>}
      </div>
      <div className="text-sm leading-relaxed text-slate-800 sm:text-base">
        <HighlightableText key={c.id} text={statement} highlights={highlights} ephemeral
          onAddHighlight={highlight => setDrafts(prev => ({
            ...prev,
            [c.id]: { text: statement, highlights: [...(prev[c.id]?.text === statement ? prev[c.id].highlights : []), { ...highlight, id: createId() }] },
          }))}
          onRemoveHighlight={id => setDrafts(prev => ({ ...prev, [c.id]: { text: statement, highlights: (prev[c.id]?.text === statement ? prev[c.id].highlights : []).filter(highlight => highlight.id !== id) } }))}
        />
      </div>
      <div className="mt-4 grid gap-4">
        {state.assets.map(a => <figure key={a.id}>
          <button type="button" onClick={() => setImage(a)} aria-label={`Ampliar ${a.title}`} className="block w-full rounded-lg border border-slate-200 bg-white p-2 focus-visible:ring-2 focus-visible:ring-indigo-500">
            <PracticalCaseImage asset={a} />
            <span className="block p-2 text-sm font-bold text-indigo-700">Ampliar imagen original</span>
          </button>
          <figcaption className="mt-1 text-xs text-slate-600">{a.title} · {c.source_title}, pág. {a.source_page}</figcaption>
        </figure>)}
      </div>
      <p className="mt-4 text-xs text-slate-500">Fuente: {c.source_title} · págs. {c.source_pages.join(', ')}</p>
    </div>
    <dialog ref={dialog} onCancel={() => setImage(null)} onClose={() => setImage(null)} className="h-[95dvh] w-[96vw] max-w-none rounded-2xl p-3 backdrop:bg-slate-950/80">
      {image && <><div className="sticky top-0 flex items-center justify-between gap-3 bg-white p-2"><span className="text-sm font-bold">{image.title} · pág. {image.source_page}</span><button type="button" autoFocus onClick={() => setImage(null)} className="rounded-lg bg-slate-900 px-4 py-2 text-white">Cerrar</button></div><p className="p-2 text-xs text-slate-600">Desplázate para consultar la imagen ampliada.</p><div className="overflow-auto"><PracticalCaseImage asset={image} enlarged /></div></>}
    </dialog>
  </section>;
}
