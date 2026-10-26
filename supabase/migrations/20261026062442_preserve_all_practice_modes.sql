alter table app.practice_sessions
  drop constraint if exists practice_sessions_mode_check;

alter table app.practice_sessions
  add constraint practice_sessions_mode_check
  check (
    mode = any (
      array[
        'standard'::text,
        'quick_five'::text,
        'weakest'::text,
        'random'::text,
        'review'::text,
        'mixed'::text,
        'simulacro'::text,
        'anti_trap'::text,
        'custom'::text
      ]
    )
  );
