import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Send } from 'lucide-react';
import { useAppLocale } from '../lib/locale';
import {
  submitQuestionErrataReport,
  type ErrataCategory,
  type QuestionErrataReport,
} from '../lib/questionErrataApi';

export interface QuestionErrataPanelProps {
  questionId: string;
  curriculum: string;
  userId?: string | null;
  /**
   * Controlled visibility. When omitted the panel renders its own
   * "Reportar errata" trigger and manages its open state internally.
   */
  open?: boolean;
  onClose?: () => void;
  existingReports?: QuestionErrataReport[];
  /** Legacy single-report alias of `existingReports`. */
  existingReport?: QuestionErrataReport | null;
  onSubmitted?: (report: QuestionErrataReport) => void;
  /** Legacy alias of `onSubmitted`. */
  onReported?: (report: QuestionErrataReport) => void;
}

const CATEGORIES: Array<{ id: ErrataCategory; es: string; eu: string }> = [
  { id: 'wrong_answer', es: 'Respuesta incorrecta', eu: 'Erantzun okerra' },
  { id: 'outdated_law', es: 'Ley derogada o reformada', eu: 'Indargabetutako edo aldatutako legea' },
  { id: 'ambiguous_wording', es: 'Redacción ambigua', eu: 'Idazkera anbiguoa' },
  { id: 'typo', es: 'Errata tipográfica', eu: 'Akats tipografikoa' },
  { id: 'other', es: 'Otro motivo', eu: 'Beste arrazoi bat' },
];

export default function QuestionErrataPanel({
  questionId,
  curriculum,
  userId = null,
  open: controlledOpen,
  onClose,
  existingReports,
  existingReport = null,
  onSubmitted,
  onReported,
}: QuestionErrataPanelProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const isControlled = typeof controlledOpen === 'boolean';
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;

  const [category, setCategory] = useState<ErrataCategory>('wrong_answer');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localReport, setLocalReport] = useState<QuestionErrataReport | null>(null);

  const activeReport =
    (localReport?.questionId === questionId ? localReport : null) ??
    existingReports?.[0] ??
    existingReport ??
    null;

  const close = () => {
    if (!isControlled) setInternalOpen(false);
    onClose?.();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const report = await submitQuestionErrataReport({
        questionId,
        curriculum,
        category,
        comment,
        userId,
      });
      setLocalReport(report);
      setComment('');
      if (!isControlled) setInternalOpen(false);
      onSubmitted?.(report);
      onReported?.(report);
    } finally {
      setSubmitting(false);
    }
  };

  const reportedBadge = (
    <div
      role="status"
      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800"
    >
      <CheckCircle2 size={14} className="text-emerald-600" aria-hidden="true" />
      <span>
        {t('Errata reportada · gracias', 'Akatsa jakinarazita · eskerrik asko')}
      </span>
    </div>
  );

  if (!open) {
    if (isControlled) {
      return localReport ? reportedBadge : null;
    }
    if (activeReport) return reportedBadge;
    return (
      <button
        type="button"
        onClick={() => setInternalOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
      >
        <AlertTriangle size={14} aria-hidden="true" />
        {t('Reportar errata', 'Akatsa jakinarazi')}
      </button>
    );
  }

  if (isControlled && localReport?.questionId === questionId) {
    return reportedBadge;
  }

  return (
    <div
      role="group"
      aria-label={t('Reportar errata en la pregunta', 'Galderaren akatsa jakinarazi')}
      onKeyDown={(event) => event.stopPropagation()}
      className="mt-3 w-full rounded-2xl border border-rose-200 bg-rose-50/70 p-4 space-y-3 text-left"
    >
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-rose-900">
        <AlertTriangle size={15} className="text-rose-600" aria-hidden="true" />
        <span>{t('Errata o impugnación', 'Akatsa edo inpugnazioa')}</span>
      </div>

      <div
        role="radiogroup"
        aria-label={t('Motivo del reporte', 'Jakinarazpenaren arrazoia')}
        className="flex flex-wrap gap-1.5"
      >
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={category === item.id}
            onClick={() => setCategory(item.id)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              category === item.id
                ? 'border-rose-600 bg-rose-600 text-white'
                : 'border-rose-200 bg-white text-slate-700 hover:bg-rose-100/60'
            }`}
          >
            {isBasque ? item.eu : item.es}
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={2}
        autoFocus
        aria-label={t('Detalle del reporte', 'Jakinarazpenaren xehetasuna')}
        placeholder={t(
          'Detalle opcional (p. ej. artículo reformado o por qué otra opción es correcta)...',
          'Xehetasun aukerakoa (adib. aldatutako artikulua edo zergatik beste aukera bat den zuzena)...',
        )}
        className="w-full rounded-xl border border-rose-200 bg-white p-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400"
      />

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={close}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50"
        >
          {t('Cancelar', 'Utzi')}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSubmit()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
        >
          <Send size={13} aria-hidden="true" />
          {t('Enviar', 'Bidali')}
        </button>
      </div>
    </div>
  );
}
