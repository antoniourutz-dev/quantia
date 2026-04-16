import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, GraduationCap, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useAppLocale } from '../lib/locale';
import { trackDecisionOnce, trackEffect } from '../lib/telemetry';

type EntryMode = 'entry' | 'request';

type AccessRequest = {
  timestamp: string;
  email: string;
  goal: string;
  locale: 'es' | 'eu';
};

const STORAGE_KEY = 'quantia.access_requests.v1';

const storeAccessRequest = (request: AccessRequest) => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    list.push(request);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    void 0;
  }
};

export default function EntryScreen({
  onLogin,
}: {
  onLogin: () => void;
}) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const [mode, setMode] = useState<EntryMode>('entry');
  const [email, setEmail] = useState('');
  const [goal, setGoal] = useState('');
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  const headline = useMemo(
    () =>
      isBasque
        ? 'Zure oposizioa, entrenamendu batekin.'
        : 'Tu oposición, con un entrenamiento.',
    [isBasque],
  );

  const subhead = useMemo(
    () =>
      isBasque
        ? 'Oposizio bakoitzerako prestaketa gidatua: eguneroko saioak, akatsen zuzenketa eta jarraitutasuna.'
        : 'Preparación guiada por oposición: sesiones diarias, corrección de fallos y continuidad.',
    [isBasque],
  );

  const oposiciones = useMemo(
    () => [
      {
        id: 'administrativo',
        title: t('Administrativo', 'Administrativo'),
        detail: t('Preparación general para Administrativo.', 'Administrativo prestaketa orokorra.'),
      },
      {
        id: 'auxiliar_administrativo',
        title: t('Auxiliar administrativo', 'Auxiliar administrativo'),
        detail: t('Entrenamiento orientado a Auxiliar.', 'Auxiliarerako entrenamendua.'),
      },
      {
        id: 'goi-teknikaria',
        title: t('Goi-teknikaria', 'Goi-teknikaria'),
        detail: t('Preparación en euskera para Goi-teknikaria.', 'Goi-teknikariarako euskarazko prestaketa.'),
      },
      {
        id: 'leyes_generales',
        title: t('Leyes Generales', 'Leyes Generales'),
        detail: t('Base común de leyes y repaso constante.', 'Legeen oinarri komuna eta etengabeko errepasoa.'),
      },
      {
        id: 'general',
        title: t('General', 'General'),
        detail: t('Entrena base y ritmo, sin especialidad.', 'Oinarria eta erritmoa, espezialitaterik gabe.'),
      },
    ],
    [t],
  );

  useEffect(() => {
    const visibleCta =
      mode === 'request'
        ? isBasque
          ? 'Sarrera eskatu'
          : 'Solicitar ingreso'
        : isBasque
          ? 'Sartu'
          : 'Entrar';

    trackDecisionOnce(`entry:${mode}:${locale}`, {
      surface: 'entry',
      primaryAction: mode === 'request' ? 'request_access' : 'enter',
      visibleCta,
    });
  }, [isBasque, locale, mode]);

  const handleSubmitRequest = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      storeAccessRequest({
        timestamp: new Date().toISOString(),
        email: trimmed,
        goal: goal.trim(),
        locale,
      });
      trackEffect({
        surface: 'entry',
        action: 'cta_clicked',
        context: { cta: t('Enviar solicitud', 'Eskaera bidali'), emailProvided: true },
      });
      setSent(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-slate-50 to-indigo-50 px-6 py-12">
      <div className="absolute top-0 right-0 -mt-28 -mr-28 h-[760px] w-[760px] rounded-full bg-indigo-500 opacity-15 blur-[170px]" />
      <div className="absolute bottom-0 left-0 -mb-28 -ml-28 h-[560px] w-[560px] rounded-full bg-emerald-500 opacity-10 blur-[150px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(99,102,241,0.08),transparent_45%),radial-gradient(circle_at_85%_70%,rgba(16,185,129,0.06),transparent_45%)]" />

      <div className="relative z-10 w-full max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-8 items-start">
          <div className="rounded-[3.5rem] border border-slate-100 bg-white p-10 md:p-12 text-slate-900 shadow-xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-700">
              <GraduationCap size={14} />
              {t('Preparación de oposiciones', 'Oposizio prestaketa')}
            </div>
            <h1 className="mt-8 text-4xl md:text-5xl font-black leading-[1.05] tracking-tight">{headline}</h1>
            <p className="mt-5 text-lg font-medium text-slate-600 leading-relaxed">{subhead}</p>

            <div className="mt-10">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  {t('Oposiciones disponibles', 'Eskuragarri dauden oposizioak')}
                </div>
                <div className="text-xs font-bold text-slate-500">
                  {t('Alta controlada · Acceso por invitación', 'Alta kontrolatua · Gonbidapen bidez')}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {oposiciones.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-slate-100 bg-slate-50 px-6 py-5">
                    <div className="text-sm font-black">{item.title}</div>
                    <div className="mt-2 text-sm font-medium text-slate-600 leading-relaxed">{item.detail}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 text-sm font-medium text-slate-600 leading-relaxed">
                {t(
                  'Si no ves tu oposición, solicita ingreso y cuéntanos cuál es.',
                  'Zure oposizioa ez badago, eskatu sarrera eta esan zein den.',
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[3.5rem] border border-slate-100 bg-white p-10 md:p-12 shadow-xl">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                    {t('Acceso', 'Sarbidea')}
                  </span>
                </div>
                <h2 className="mt-3 text-3xl font-black text-slate-900 tracking-tight">
                  {mode === 'request' ? t('Solicitud de ingreso', 'Sarrera eskaera') : t('Elige una opción', 'Aukeratu aukera bat')}
                </h2>
                <p className="mt-2 text-slate-500 text-lg font-medium leading-relaxed">
                  {mode === 'request'
                    ? t('Déjanos tu email y tu objetivo. En esta fase la solicitud queda registrada en este dispositivo.', 'Utzi zure emaila eta helburua. Fase honetan eskaera gailu honetan erregistratzen da.')
                    : t('Solicita ingreso para empezar, o entra si ya tienes acceso.', 'Eskatu sarrera hasteko, edo sartu sarbidea baduzu.')}
                </p>
              </div>
            </div>

            {mode === 'request' ? (
              <div className="mt-10 space-y-6">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                    {t('Email', 'Emaila')}
                  </div>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
                    placeholder="tu@email.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                    {t('Objetivo (opcional)', 'Helburua (aukerakoa)')}
                  </div>
                  <input
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
                    placeholder={t('Ej: Auxiliar Administrativo, junio', 'Adib: Administrari laguntzailea, ekaina')}
                  />
                </div>

                {sent ? (
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-6 py-5">
                    <div className="text-sm font-black text-emerald-900">
                      {t('Solicitud registrada', 'Eskaera erregistratua')}
                    </div>
                    <div className="mt-2 text-sm font-medium text-emerald-800 leading-relaxed">
                      {t('Queda guardada en este dispositivo para seguimiento interno. Si tienes un canal de alta, comparte tu email allí.', 'Gailu honetan gordeta geratzen da barne-jarraipenerako. Alta egiteko kanal bat baduzu, partekatu zure emaila bertan.')}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    type="button"
                    onClick={handleSubmitRequest}
                    disabled={saving || !email.trim()}
                    className="flex-1 flex items-center justify-center gap-3 rounded-[2rem] bg-indigo-600 px-6 py-5 text-white font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-0.5 disabled:bg-slate-300 disabled:shadow-none"
                  >
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail size={18} />}
                    {t('Enviar solicitud', 'Eskaera bidali')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('entry')}
                    className="flex-1 rounded-[2rem] border border-slate-200 bg-white px-6 py-5 text-slate-700 font-black text-lg hover:bg-slate-50 transition-all"
                  >
                    {t('Volver', 'Itzuli')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-10 space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    trackEffect({
                      surface: 'entry',
                      action: 'cta_clicked',
                      context: { cta: t('Solicitar ingreso', 'Sarrera eskatu') },
                    });
                    setMode('request');
                    setSent(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 rounded-[2rem] bg-indigo-600 px-6 py-5 text-white font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
                >
                  <Mail size={20} />
                  {t('Solicitar ingreso', 'Sarrera eskatu')}
                  <ArrowRight size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    trackEffect({
                      surface: 'entry',
                      action: 'cta_clicked',
                      context: { cta: t('Entrar', 'Sartu') },
                    });
                    onLogin();
                  }}
                  className="w-full rounded-[2rem] border border-slate-200 bg-white px-6 py-5 text-slate-700 font-black text-lg hover:bg-slate-50 transition-all"
                >
                  {t('Entrar', 'Sartu')}
                </button>
                <div className="rounded-3xl border border-slate-100 bg-slate-50 px-6 py-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    {t('Nota', 'Oharra')}
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-600 leading-relaxed">
                    {t(
                      'Esta es una página de entrada. El acceso se gestiona de forma controlada.',
                      'Hau sarrera-orria da. Sarbidea modu kontrolatuan kudeatzen da.',
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
