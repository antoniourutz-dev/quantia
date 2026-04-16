import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Search, Trash2, User2, X } from 'lucide-react';
import { useAppLocale } from '../../lib/locale';
import type { AdminUserDetail, AdminUserListItem } from '../../types';
import {
  adminCreateUser,
  adminDeleteUser,
  adminGetUserDetail,
  adminListUsers,
  adminResetUserData,
  adminSetUserActiveOpposition,
  adminSetUserActive,
  adminSetUserPassword,
  adminUpdateUserName,
} from '../../lib/quantiaApi';

type ConfirmAction =
  | { type: 'delete'; user: AdminUserDetail; confirm: string }
  | { type: 'reset'; user: AdminUserDetail; confirm: string }
  | null;

export default function AdminStudents({ onClose }: { onClose: () => void }) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [creating, setCreating] = useState(false);

  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [oppositionDraft, setOppositionDraft] = useState('');
  const [savingOpposition, setSavingOpposition] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [acting, setActing] = useState(false);

  const refresh = async (nextPage = page) => {
    setLoading(true);
    setNotice(null);
    try {
      const result = await adminListUsers({ search, page: nextPage, perPage });
      setItems(result.items);
      setTotal(result.total);
      setPage(result.page);
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : t('Error cargando alumnos.', 'Errorea ikasleak kargatzean.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(1);
    setSelectedId(null);
    setDetail(null);
  }, [perPage]);

  const openUser = async (userId: string) => {
    setSelectedId(userId);
    setDetail(null);
    setDetailLoading(true);
    setNotice(null);
    try {
      const d = await adminGetUserDetail(userId);
      setDetail(d);
      setNameDraft(d.currentUsername ?? '');
      setPasswordDraft('');
      setOppositionDraft(d.activeOppositionId ?? '');
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : t('Error cargando el alumno.', 'Errorea ikaslea kargatzean.') });
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDate = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: '2-digit' });
    return (value: string | null) => {
      if (!value) return '—';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '—';
      return formatter.format(date);
    };
  }, [locale]);

  const handleCreate = async () => {
    setCreating(true);
    setNotice(null);
    try {
      await adminCreateUser({ email: createEmail, password: createPassword, username: createUsername || null });
      setCreateOpen(false);
      setCreateEmail('');
      setCreatePassword('');
      setCreateUsername('');
      setNotice({ kind: 'success', text: t('Usuario creado.', 'Erabiltzailea sortuta.') });
      await refresh(1);
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : t('No se ha podido crear el usuario.', 'Ezin izan da erabiltzailea sortu.') });
    } finally {
      setCreating(false);
    }
  };

  const handleSaveName = async () => {
    if (!detail) return;
    setSavingName(true);
    setNotice(null);
    try {
      await adminUpdateUserName({ userId: detail.userId, username: nameDraft });
      const updated = await adminGetUserDetail(detail.userId);
      setDetail(updated);
      setNameDraft(updated.currentUsername ?? '');
      setNotice({ kind: 'success', text: t('Nombre actualizado.', 'Izena eguneratuta.') });
      await refresh(page);
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : t('No se ha podido actualizar el nombre.', 'Ezin izan da izena eguneratu.') });
    } finally {
      setSavingName(false);
    }
  };

  const handleSetPassword = async () => {
    if (!detail) return;
    setSavingPassword(true);
    setNotice(null);
    try {
      await adminSetUserPassword({ userId: detail.userId, password: passwordDraft });
      setPasswordDraft('');
      setNotice({ kind: 'success', text: t('Contraseña actualizada.', 'Pasahitza eguneratuta.') });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : t('No se ha podido cambiar la contraseña.', 'Ezin izan da pasahitza aldatu.') });
    } finally {
      setSavingPassword(false);
    }
  };

  const toggleActive = async (active: boolean) => {
    if (!detail) return;
    setActing(true);
    setNotice(null);
    try {
      await adminSetUserActive({ userId: detail.userId, active });
      setNotice({ kind: 'success', text: active ? t('Cuenta reactivada.', 'Kontua berraktibatuta.') : t('Cuenta desactivada.', 'Kontua desaktibatuta.') });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : t('No se ha podido actualizar el estado.', 'Ezin izan da egoera eguneratu.') });
    } finally {
      setActing(false);
    }
  };

  const handleSaveOpposition = async () => {
    if (!detail) return;
    setSavingOpposition(true);
    setNotice(null);
    try {
      await adminSetUserActiveOpposition({ userId: detail.userId, oppositionId: oppositionDraft });
      const updated = await adminGetUserDetail(detail.userId);
      setDetail(updated);
      setOppositionDraft(updated.activeOppositionId ?? '');
      setNotice({ kind: 'success', text: t('Contexto actualizado.', 'Testuingurua eguneratuta.') });
      await refresh(page);
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : t('No se ha podido cambiar el contexto.', 'Ezin izan da testuingurua aldatu.') });
    } finally {
      setSavingOpposition(false);
    }
  };

  const confirmMatches = (action: ConfirmAction) => {
    if (!action) return false;
    const token = action.type === 'delete' ? 'BORRAR' : 'RESET';
    return action.confirm.trim().toUpperCase() === token;
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    if (!confirmMatches(confirmAction)) return;
    setActing(true);
    setNotice(null);
    try {
      if (confirmAction.type === 'delete') {
        await adminDeleteUser(confirmAction.user.userId);
        setNotice({ kind: 'success', text: t('Usuario borrado.', 'Erabiltzailea ezabatuta.') });
        setSelectedId(null);
        setDetail(null);
        await refresh(1);
      } else {
        await adminResetUserData(confirmAction.user.userId);
        const updated = await adminGetUserDetail(confirmAction.user.userId);
        setDetail(updated);
        setNotice({ kind: 'success', text: t('Datos borrados.', 'Datuak ezabatuta.') });
      }
      setConfirmAction(null);
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : t('Acción fallida.', 'Ekintza huts egin du.') });
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Administración', 'Administrazioa')}</div>
          <h2 className="mt-3 text-3xl font-black text-slate-900 tracking-tight">{t('Gestión de alumnos', 'Ikasleen kudeaketa')}</h2>
          <div className="mt-2 text-sm font-medium text-slate-500">{t('Buscar, revisar y actuar.', 'Bilatu, berrikusi eta ekin.')}</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all"
          >
            {t('Volver', 'Itzuli')}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
          >
            <Plus size={16} />
            {t('Crear usuario', 'Erabiltzailea sortu')}
          </button>
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('Buscar', 'Bilatu')}</div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                placeholder={t('Email o nombre...', 'Email edo izena...')}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('Tamaño', 'Tamaina')}</div>
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
            >
              {[25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex gap-2">
            <button
              type="button"
              onClick={() => void refresh(1)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all"
            >
              {t('Aplicar', 'Aplikatu')}
            </button>
          </div>
          <div className="md:col-span-2 flex justify-end text-sm font-bold text-slate-500">
            {total !== null ? `${t('Total', 'Guztira')}: ${total}` : null}
          </div>
        </div>

        {notice ? (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm font-bold ${
              notice.kind === 'success'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                : 'border-rose-100 bg-rose-50 text-rose-800'
            }`}
          >
            {notice.text}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_520px] gap-6 items-start">
        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-100">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              {loading ? t('Cargando...', 'Kargatzen...') : `${t('Alumnos', 'Ikasleak')}: ${items.length}`}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refresh(Math.max(1, page - 1))}
                disabled={page <= 1 || loading}
                className="h-10 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 disabled:opacity-50"
              >
                {t('Prev', 'Aurrekoa')}
              </button>
              <div className="h-10 px-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-700 flex items-center">
                {page}
              </div>
              <button
                type="button"
                onClick={() => void refresh(page + 1)}
                disabled={loading || (total !== null ? page * perPage >= total : items.length < perPage)}
                className="h-10 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 disabled:opacity-50"
              >
                {t('Next', 'Hurrengoa')}
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <button
                key={item.userId}
                type="button"
                onClick={() => void openUser(item.userId)}
                className={`w-full text-left px-6 py-5 hover:bg-slate-50 transition-all ${
                  selectedId === item.userId ? 'bg-indigo-50/60' : 'bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900 truncate">{item.currentUsername ?? item.email ?? item.userId}</div>
                    <div className="mt-1 text-xs font-bold text-slate-500 truncate">{item.email ?? '—'}</div>
                    <div className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex flex-wrap gap-2">
                      <span>{t('Alta', 'Alta')}: {formatDate(item.createdAt)}</span>
                      <span>{t('Último', 'Azkena')}: {formatDate(item.lastSignInAt)}</span>
                      {item.activeCurriculum ? <span>{t('Activo', 'Aktibo')}: {item.activeCurriculum}</span> : null}
                    </div>
                  </div>
                  <div className="shrink-0 h-10 w-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600">
                    <User2 size={16} />
                  </div>
                </div>
              </button>
            ))}

            {items.length === 0 && !loading ? (
              <div className="px-6 py-10 text-slate-500 font-bold">{t('Sin resultados.', 'Emaitzarik ez.')}</div>
            ) : null}
            {loading ? (
              <div className="px-6 py-10 text-slate-500 flex items-center justify-center gap-3 font-bold">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('Cargando...', 'Kargatzen...')}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Ficha', 'Fitxa')}</div>
              <div className="mt-2 text-xl font-black text-slate-900 truncate">
                {detail ? (detail.email ?? detail.userId) : t('Selecciona un alumno', 'Hautatu ikasle bat')}
              </div>
            </div>
            {detail ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setDetail(null);
                  setConfirmAction(null);
                }}
                className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>

          {detailLoading ? (
            <div className="mt-8 text-slate-500 flex items-center justify-center gap-3 font-bold">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('Cargando...', 'Kargatzen...')}
            </div>
          ) : null}

          {detail ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-2">
                <div className="text-xs font-bold text-slate-600">{t('ID', 'ID')}: {detail.userId}</div>
                <div className="text-xs font-bold text-slate-600">{t('Alta', 'Alta')}: {formatDate(detail.createdAt)}</div>
                <div className="text-xs font-bold text-slate-600">{t('Último acceso', 'Azken sarbidea')}: {formatDate(detail.lastSignInAt)}</div>
                {detail.activeCurriculum ? (
                  <div className="text-xs font-bold text-slate-600">{t('Contexto', 'Testuingurua')}: {detail.activeCurriculum}</div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{t('Sesiones', 'Saioak')}</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{detail.sessionsTotal ?? '—'}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{t('Sesiones 7d', 'Saioak 7e')}</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{detail.sessionsLast7d ?? '—'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{t('Acierto 7d', 'Asmatze 7e')}</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">
                    {typeof detail.accuracyRateLast7d === 'number' ? `${Math.round(detail.accuracyRateLast7d * 100)}%` : '—'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{t('Respondidas 7d', 'Erantzunda 7e')}</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{detail.totalAnsweredLast7d ?? '—'}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Nombre', 'Izena')}</div>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-4 text-slate-700 font-black text-base shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  {savingName ? t('Guardando...', 'Gordetzen...') : t('Guardar nombre', 'Izena gorde')}
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Oposición activa', 'Oposizio aktiboa')}</div>
                <input
                  value={oppositionDraft}
                  onChange={(e) => setOppositionDraft(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder="opposition_id (UUID)"
                />
                <button
                  type="button"
                  onClick={handleSaveOpposition}
                  disabled={savingOpposition || !oppositionDraft.trim()}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-4 text-slate-700 font-black text-base shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  {savingOpposition ? t('Guardando...', 'Gordetzen...') : t('Cambiar contexto activo', 'Testuinguru aktiboa aldatu')}
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Cambiar contraseña', 'Pasahitza aldatu')}</div>
                <input
                  value={passwordDraft}
                  onChange={(e) => setPasswordDraft(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder={t('Nueva contraseña', 'Pasahitz berria')}
                />
                <button
                  type="button"
                  onClick={handleSetPassword}
                  disabled={savingPassword || !passwordDraft.trim()}
                  className="w-full rounded-2xl bg-slate-900 px-6 py-4 text-white font-black text-base shadow-lg disabled:bg-slate-300"
                >
                  {savingPassword ? t('Guardando...', 'Gordetzen...') : t('Actualizar contraseña', 'Pasahitza eguneratu')}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void toggleActive(false)}
                  disabled={acting}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-4 text-slate-700 font-black text-base shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  {t('Desactivar', 'Desaktibatu')}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleActive(true)}
                  disabled={acting}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-4 text-slate-700 font-black text-base shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  {t('Reactivar', 'Berraktibatu')}
                </button>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-black">
                  <AlertTriangle size={18} />
                  {t('Acciones sensibles', 'Ekintza sentikorrak')}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmAction({ type: 'reset', user: detail, confirm: '' })}
                  className="w-full rounded-2xl bg-white px-6 py-4 text-slate-900 font-black text-base border border-amber-200 hover:bg-amber-50 transition-all"
                >
                  {t('Resetear datos (solo sesiones)', 'Datuak reset (saioak bakarrik)')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction({ type: 'delete', user: detail, confirm: '' })}
                  className="w-full rounded-2xl bg-rose-600 px-6 py-4 text-white font-black text-base shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all flex items-center justify-center gap-3"
                >
                  <Trash2 size={18} />
                  {t('Borrar usuario', 'Erabiltzailea ezabatu')}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-8 text-slate-500 font-bold">{t('Selecciona un alumno del listado.', 'Hautatu ikasle bat zerrendatik.')}</div>
          )}
        </div>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50">
          <button type="button" onClick={() => setCreateOpen(false)} className="absolute inset-0 bg-black/40" aria-hidden="true" />
          <div className="absolute left-0 right-0 bottom-0 rounded-t-[2.5rem] border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Crear', 'Sortu')}</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{t('Nuevo usuario', 'Erabiltzaile berria')}</div>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
              <input
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                placeholder="email"
              />
              <input
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                placeholder={t('Contraseña inicial', 'Hasierako pasahitza')}
              />
              <input
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                placeholder={t('Nombre (opcional)', 'Izena (aukerakoa)')}
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full rounded-[2rem] bg-slate-900 px-6 py-5 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl disabled:bg-slate-300"
              >
                {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus size={18} />}
                {creating ? t('Creando...', 'Sortzen...') : t('Crear usuario', 'Erabiltzailea sortu')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="fixed inset-0 z-50">
          <button type="button" onClick={() => setConfirmAction(null)} className="absolute inset-0 bg-black/40" aria-hidden="true" />
          <div className="absolute left-0 right-0 bottom-0 rounded-t-[2.5rem] border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Confirmación', 'Baieztapena')}</div>
                <div className="mt-2 text-2xl font-black text-slate-900">
                  {confirmAction.type === 'delete' ? t('Borrar usuario', 'Erabiltzailea ezabatu') : t('Resetear datos', 'Datuak reset')}
                </div>
                <div className="mt-2 text-sm font-bold text-slate-600">
                  {confirmAction.type === 'delete'
                    ? t('Escribe BORRAR para confirmar.', 'Idatzi BORRAR baieztatzeko.')
                    : t('Escribe RESET para confirmar.', 'Idatzi RESET baieztatzeko.')}
                </div>
              </div>
              <button type="button" onClick={() => setConfirmAction(null)} className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
              <input
                value={confirmAction.confirm}
                onChange={(e) => setConfirmAction((prev) => (prev ? { ...prev, confirm: e.target.value } : prev))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-rose-400 focus:bg-white"
              />
              <button
                type="button"
                onClick={executeConfirmAction}
                disabled={!confirmMatches(confirmAction) || acting}
                className="w-full rounded-[2rem] bg-rose-600 px-6 py-5 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl disabled:bg-slate-300"
              >
                {acting ? <Loader2 className="h-5 w-5 animate-spin" /> : <AlertTriangle size={18} />}
                {confirmAction.type === 'delete' ? t('Borrar', 'Ezabatu') : t('Reset', 'Reset')}
              </button>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-xs font-bold text-slate-600">
                {confirmAction.type === 'delete'
                  ? t('Esto elimina la cuenta de Auth. No se puede deshacer.', 'Honek Auth kontua ezabatzen du. Ezin da atzera egin.')
                  : t('Esto borra sesiones del alumno. No afecta a preguntas.', 'Honek ikaslearen saioak ezabatzen ditu. Ez du galderarik aldatzen.')}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
