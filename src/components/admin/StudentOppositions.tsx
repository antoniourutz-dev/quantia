import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAppLocale } from '../../lib/locale';

type Option = { id: string; name: string; assigned: boolean };

export default function StudentOppositions({ userId }: { userId: string }) {
  const eu = useAppLocale() === 'eu';
  const [options, setOptions] = useState<Option[] | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void supabase.rpc('admin_student_oppositions', { p_student: userId }).then(({ data, error }) => {
      if (!active) return;
      if (error) { setMessage(error.message); return; }
      const rows = data as Option[];
      setOptions(rows);
      setSelection(rows.filter(o => o.assigned).map(o => o.id));
    });
    return () => { active = false; };
  }, [userId]);
  async function save() {
    if (!options || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('set_student_oppositions', {
        p_student: userId, p_ids: selection, p_expected: options.filter(o => o.assigned).map(o => o.id),
      });
      if (error) throw error;
      setOptions(options.map(o => ({ ...o, assigned: selection.includes(o.id) })));
      setMessage(eu ? 'Baimenak gordeta.' : 'Permisos guardados.');
    } catch (error) {
      setMessage(String((error as Error)?.message || error));
    } finally { setBusy(false); }
  }
  return <fieldset disabled={busy} className="space-y-2">
    <legend className="font-bold">{eu ? 'Baimendutako oposizioak' : 'Oposiciones autorizadas'}</legend>
    {options?.map(o => <label key={o.id} className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={selection.includes(o.id)} onChange={e => {
        setMessage('');
        setSelection(e.target.checked ? [...selection, o.id] : selection.filter(id => id !== o.id));
      }} />{o.name}
    </label>)}
    {options && !selection.length && <p>{eu ? 'Ikasleak ez du oposiziorik ikusiko.' : 'El alumno no verá ninguna oposición.'}</p>}
    <button className="rounded-xl border px-4 py-2" disabled={!options || !options.some(o => o.assigned !== selection.includes(o.id))} onClick={save}>{eu ? 'Baimenak gorde' : 'Guardar permisos'}</button>
    <p role="status">{message}</p>
  </fieldset>;
}
