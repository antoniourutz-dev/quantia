import { useEffect, useState } from 'react';
import { FileText, Save, Trash2 } from 'lucide-react';
import { useAppLocale } from '../lib/locale';

export interface QuestionNoteDrawerProps {
  open: boolean;
  questionId?: string;
  questionNumber?: number | null;
  /** Current note value (preferred prop name). */
  note?: string;
  /** Legacy alias of `note`. */
  initialNote?: string;
  onClose: () => void;
  onSave: (note: string) => Promise<void> | void;
}

export default function QuestionNoteDrawer({
  open,
  questionNumber = null,
  note,
  initialNote,
  onClose,
  onSave,
}: QuestionNoteDrawerProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const resolvedNote = String(note ?? initialNote ?? '');
  const [draft, setDraft] = useState(resolvedNote);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(resolvedNote);
    }
  }, [resolvedNote, open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      setDraft('');
      await onSave('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('Nota personal de la pregunta', 'Galderaren ohar pertsonala')}
      onKeyDown={(event) => event.stopPropagation()}
      className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-900">
        <FileText size={15} className="text-amber-700" aria-hidden="true" />
        <span>
          {t('Nota personal', 'Ohar pertsonala')}
          {questionNumber != null ? ` · #${questionNumber}` : ''}
        </span>
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        autoFocus
        aria-label={t('Texto de la nota', 'Oharraren testua')}
        placeholder={t(
          'Escribe tu regla mnemotécnica, artículo clave o recordatorio personal...',
          'Idatzi zure arau mnemoteknikoa, artikulu gakoa edo oroigarri pertsonala...',
        )}
        className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {resolvedNote.trim() ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleDelete()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            <Trash2 size={14} aria-hidden="true" />
            {t('Borrar nota', 'Oharra ezabatu')}
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
          >
            {t('Cancelar', 'Utzi')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
          >
            <Save size={14} aria-hidden="true" />
            {t('Guardar nota', 'Oharra gorde')}
          </button>
        </div>
      </div>
    </div>
  );
}
