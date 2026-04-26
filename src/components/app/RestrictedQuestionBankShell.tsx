import { useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogOut } from 'lucide-react';
import StudyQuestionBank from '../StudyQuestionBank';
import { LocaleProvider, getLocaleForCurriculum } from '../../lib/locale';
import { signOut } from '../../lib/quantiaApi';

const STORAGE_KEY = 'quantia.restricted.curriculum.v1';
type SessionAppMetadata = Record<string, unknown> & {
  allowedCurriculumKeys?: unknown;
  allowed_curriculum_keys?: unknown;
};

const readStoredCurriculum = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const writeStoredCurriculum = (value: string) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
};

const canonicalizeAllowedKey = (value: string) => value.trim().toLowerCase().replace(/_/g, '-');
const readSessionAppMetadata = (session: Session): SessionAppMetadata | null => {
  const metadata = session.user.app_metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  return metadata as SessionAppMetadata;
};
const isOpeosi = (session: Session) => String(session.user.email ?? '').trim().toLowerCase() === 'opeosi@oposik.app';
const formatCurriculumLabel = (value: string, locale: 'es' | 'eu') => {
  const normalized = canonicalizeAllowedKey(value);
  if (normalized === 'administrativo') return locale === 'eu' ? 'Administrativo' : 'Administrativo';
  if (normalized === 'auxiliar-administrativo' || normalized === 'auxiliar_administrativo') {
    return locale === 'eu' ? 'Auxiliar administrativo' : 'Auxiliar administrativo';
  }
  return value;
};

export default function RestrictedQuestionBankShell({ session }: { session: Session }) {
  const allowedCurriculums = useMemo(() => {
    if (isOpeosi(session)) {
      return ['administrativo', 'auxiliar-administrativo'];
    }

    const appMetadata = readSessionAppMetadata(session);
    const raw = Array.isArray(appMetadata?.allowedCurriculumKeys)
      ? appMetadata.allowedCurriculumKeys
      : Array.isArray(appMetadata?.allowed_curriculum_keys)
        ? appMetadata.allowed_curriculum_keys
        : [];

    const list = raw
      .map((value) => (typeof value === 'string' ? value : ''))
      .map(canonicalizeAllowedKey)
      .filter(Boolean);

    const normalized = Array.from(new Set(list));

    if (normalized.length === 0) {
      return ['administrativo', 'auxiliar-administrativo'];
    }

    return normalized;
  }, [session.user.app_metadata]);

  const [curriculum, setCurriculum] = useState(() => {
    const stored = canonicalizeAllowedKey(readStoredCurriculum());
    const match = allowedCurriculums.find((value) => canonicalizeAllowedKey(value) === stored);
    return match || allowedCurriculums[0] || 'administrativo';
  });

  const curriculumLocale = useMemo(() => getLocaleForCurriculum(curriculum), [curriculum]);

  return (
    <LocaleProvider locale={curriculumLocale}>
      <div className="min-h-[100svh] bg-slate-50 text-slate-900">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="font-black tracking-tighter text-xl">kuantia</div>
              <div className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Banco de preguntas</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={curriculum}
                onChange={(e) => {
                  const next = canonicalizeAllowedKey(e.target.value);
                  if (!allowedCurriculums.includes(next)) return;
                  setCurriculum(next);
                  writeStoredCurriculum(next);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none hover:bg-slate-50"
              >
                {allowedCurriculums.map((value) => (
                  <option key={value} value={value}>
                    {formatCurriculumLabel(value, curriculumLocale)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  void signOut();
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 pt-6">
          <StudyQuestionBank curriculum={curriculum} onBack={null} />
        </div>
      </div>
    </LocaleProvider>
  );
}
