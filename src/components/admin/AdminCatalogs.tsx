import { useEffect, useMemo, useState } from 'react';
import { Database, Loader2, Save, X } from 'lucide-react';
import { useAppLocale } from '../../lib/locale';
import { adminGetTableColumns, adminListCatalogTables, adminUpsertCatalogRow } from '../../lib/quantiaApi';

type ColumnInfo = {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  ordinalPosition: number;
};

type TableState = {
  loading: boolean;
  notice: { kind: 'success' | 'error'; text: string } | null;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  newRow: Record<string, string>;
  saving: boolean;
};

const DEFAULT_TABLES = [
  { schema: 'public', table: 'oppositions' },
  { schema: 'public', table: 'opposition_configs' },
  { schema: 'public', table: 'subjects' },
  { schema: 'public', table: 'question_scopes' },
  { schema: 'public', table: 'user_opposition_profiles' },
  { schema: 'app', table: 'general_laws' },
  { schema: 'app', table: 'general_law_blocks' },
] as const;

const readText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const isSystemColumn = (name: string) => ['created_at', 'updated_at'].includes(name);

const isEditableColumn = (col: ColumnInfo) => {
  const name = col.columnName;
  if (isSystemColumn(name)) return false;
  if (name === 'id' && col.columnDefault) return false;
  return true;
};

const requiredForInsert = (col: ColumnInfo) => !col.isNullable && !col.columnDefault && !isSystemColumn(col.columnName);

const labelFor = (name: string) => name.replace(/_/g, ' ');

export default function AdminCatalogs({ onClose }: { onClose: () => void }) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const [tables, setTables] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>(`${DEFAULT_TABLES[0].schema}.${DEFAULT_TABLES[0].table}`);
  const [state, setState] = useState<TableState>({
    loading: false,
    notice: null,
    columns: [],
    rows: [],
    newRow: {},
    saving: false,
  });

  const editableColumns = useMemo(() => state.columns.filter(isEditableColumn), [state.columns]);
  const requiredColumns = useMemo(() => state.columns.filter(requiredForInsert).map((c) => c.columnName), [state.columns]);

  const loadTables = async () => {
    try {
      const list = await adminListCatalogTables(DEFAULT_TABLES as unknown as { schema: string; table: string }[]);
      const normalized = list.map((x) => `${x.schema}.${x.table}`);
      const fallback = DEFAULT_TABLES.map((x) => `${x.schema}.${x.table}`);
      setTables(normalized.length ? normalized : fallback);
      setSelected((prev) => (normalized.includes(prev) ? prev : normalized[0] ?? fallback[0]));
    } catch {
      setTables(DEFAULT_TABLES.map((x) => `${x.schema}.${x.table}`));
    }
  };

  const loadSelected = async () => {
    setState((prev) => ({ ...prev, loading: true, notice: null }));
    try {
      const [schema, table] = selected.split('.');
      const columns = await adminGetTableColumns({ schema, table });
      const rows = await adminUpsertCatalogRow({ schema: schema as 'public' | 'app', table, action: 'list' });
      const newRow: Record<string, string> = {};
      for (const col of columns) {
        if (!isEditableColumn(col)) continue;
        newRow[col.columnName] = '';
      }
      setState((prev) => ({ ...prev, columns, rows, newRow, loading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        notice: { kind: 'error', text: error instanceof Error ? error.message : t('Error cargando catálogo.', 'Errorea katalogoa kargatzean.') },
      }));
    }
  };

  useEffect(() => {
    void loadTables();
  }, []);

  useEffect(() => {
    if (!selected) return;
    void loadSelected();
  }, [selected]);

  const setNewValue = (key: string, value: string) => {
    setState((prev) => ({ ...prev, newRow: { ...prev.newRow, [key]: value } }));
  };

  const saveNew = async () => {
    const missing = requiredColumns.filter((key) => !readText(state.newRow[key]));
    if (missing.length > 0) {
      setState((prev) => ({
        ...prev,
        notice: { kind: 'error', text: `${t('Faltan campos obligatorios', 'Derrigorrezko eremuak falta dira')}: ${missing.join(', ')}` },
      }));
      return;
    }
    setState((prev) => ({ ...prev, saving: true, notice: null }));
    try {
      const payload: Record<string, unknown> = {};
      for (const col of editableColumns) {
        const raw = readText(state.newRow[col.columnName]);
        payload[col.columnName] = raw ? raw : null;
      }
      const [schema, table] = selected.split('.');
      await adminUpsertCatalogRow({ schema: schema as 'public' | 'app', table, action: 'insert', row: payload });
      setState((prev) => ({ ...prev, notice: { kind: 'success', text: t('Guardado.', 'Gordeta.') } }));
      await loadSelected();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        notice: { kind: 'error', text: error instanceof Error ? error.message : t('No se ha podido guardar.', 'Ezin izan da gorde.') },
      }));
    } finally {
      setState((prev) => ({ ...prev, saving: false }));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Administración', 'Administrazioa')}</div>
          <h2 className="mt-3 text-3xl font-black text-slate-900 tracking-tight">{t('Catálogos', 'Katalogoak')}</h2>
          <div className="mt-2 text-sm font-medium text-slate-500">{t('Oposiciones, leyes y temas.', 'Oposizioak, legeak eta gaiak.')}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all"
        >
          {t('Volver', 'Itzuli')}
        </button>
      </div>

      <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Tabla', 'Taula')}</div>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
            >
              {tables.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={loadSelected}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all"
            >
              {t('Recargar', 'Berriz kargatu')}
            </button>
          </div>
        </div>

        {state.notice ? (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm font-bold ${
              state.notice.kind === 'success'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                : 'border-rose-100 bg-rose-50 text-rose-800'
            }`}
          >
            {state.notice.text}
          </div>
        ) : null}
      </div>

      <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Crear', 'Sortu')}</div>
            <div className="mt-2 text-xl font-black text-slate-900 truncate">{selected}</div>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2">
            <Database size={14} />
            {t('Campos', 'Eremuak')}: {editableColumns.length}
          </div>
        </div>

        {state.loading ? (
          <div className="py-10 text-slate-500 flex items-center justify-center gap-3 font-bold">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('Cargando...', 'Kargatzen...')}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {editableColumns.slice(0, 8).map((col) => (
                <div key={col.columnName} className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    {labelFor(col.columnName)}{requiredForInsert(col) ? ' *' : ''}
                  </div>
                  <input
                    value={state.newRow[col.columnName] ?? ''}
                    onChange={(e) => setNewValue(col.columnName, e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  />
                </div>
              ))}
            </div>

            {editableColumns.length > 8 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Más campos', 'Eremu gehiago')}</div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {editableColumns.slice(8).map((col) => (
                    <div key={col.columnName} className="space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        {labelFor(col.columnName)}{requiredForInsert(col) ? ' *' : ''}
                      </div>
                      <input
                        value={state.newRow[col.columnName] ?? ''}
                        onChange={(e) => setNewValue(col.columnName, e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, newRow: {} }))}
                className="w-full rounded-[2rem] border border-slate-200 bg-white px-6 py-5 text-slate-700 font-black text-lg flex items-center justify-center gap-3 shadow-sm hover:bg-slate-50 transition-all"
              >
                <X size={18} />
                {t('Limpiar', 'Garbitu')}
              </button>
              <button
                type="button"
                onClick={saveNew}
                disabled={state.saving}
                className="w-full rounded-[2rem] bg-slate-900 px-6 py-5 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl disabled:bg-slate-300"
              >
                {state.saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save size={18} />}
                {state.saving ? t('Guardando...', 'Gordetzen...') : t('Guardar', 'Gorde')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            {t('Registros', 'Erregistroak')}: {state.rows.length}
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {state.rows.slice(0, 50).map((row, index) => (
            <div key={index} className="px-6 py-4">
              <div className="text-xs font-bold text-slate-700 break-all">
                {state.columns
                  .slice(0, 6)
                  .map((c) => `${c.columnName}: ${String((row as Record<string, unknown>)[c.columnName] ?? '—')}`)
                  .join(' • ')}
              </div>
            </div>
          ))}
          {state.rows.length === 0 && !state.loading ? (
            <div className="px-6 py-10 text-slate-500 font-bold">{t('Sin registros.', 'Erregistrorik ez.')}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
