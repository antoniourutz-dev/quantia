do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'preguntas'
      and c.relkind = 'r'
  ) then
    raise notice 'Tabla public.preguntas no encontrada; no se aplican metadatos de examen.';
    return;
  end if;

  alter table public.preguntas
    add column if not exists exam_source_key text,
    add column if not exists exam_source_title text,
    add column if not exists exam_source_year integer,
    add column if not exists exam_question_scope text;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'preguntas_exam_question_scope_check'
      and conrelid = 'public.preguntas'::regclass
  ) then
    alter table public.preguntas
      add constraint preguntas_exam_question_scope_check
      check (exam_question_scope is null or exam_question_scope in ('common', 'specific', 'mixed'));
  end if;

  create index if not exists preguntas_exam_source_idx
    on public.preguntas (opposition_id, exam_source_key, exam_question_scope, numero);
end
$$;
