# Casos prácticos

The selector in `TestSelection` discovers published cases through authenticated
Supabase queries. Only curricula with visible cases get the new option. Choosing
one or all cases invokes the existing `handleStartChallenge` callback, preserving
the existing `custom` session mode, correction engine, statistics and activity.
Case titles distinguish these sessions without introducing a second test engine.

`TestInterface` resolves context by the exact question primary key in every mode,
including simulacros and error review. It disables answers until the context and
any original images have been verified. Errors offer retry. Case changes clear
stale context, and original images can be enlarged in a keyboard accessible dialog.
The mobile shortcut returns to the full statement. Images retain their original
aspect ratio. The OSANEBI map is displayed rotated clockwise by 90 degrees for
reading, with a 520 px preview and a 900 px enlarged view; its stored PNG bytes
and integrity hash are unchanged.

The case statement reuses `HighlightableText` in ephemeral mode with the same
color toolbar as questions. Draft marks are isolated by case and remain available
across that case's questions (including a return to it during the same test).
Clicking a mark removes it; the case's Clear button removes all of its marks.
Drafts live only in the mounted test component and disappear on exit/reload;
no annotation API or browser storage persists them. Source text changes invalidate
old draft offsets without modifying the source or the original paragraph breaks.

## Data and access

- `practical_cases`: opposition, curriculum, ordered case, statement and source.
- `practical_case_questions`: unique existing question ID and order within a case.
- `practical_case_assets`: ordered PNG metadata, original source page and SHA-256.
- `practical_case_asset_chunks`: PNG bytes encoded as base64, separate from the
  catalog and protected by the same assignment and publication restrictions.

The initial four images are a small collection (about 2.2 MB). Protected database
chunks avoid public object URLs and exposing documents through repository assets.
Images are fetched on demand and cached only within the mounted test component;
case authorization is checked again when navigating questions. No new browser
storage or service-worker runtime cache holds this material. For a much larger
collection, move bytes to a private Storage bucket with equivalent RLS.

All four tables have RLS, authenticated read-only grants and no anonymous grants.
Every policy explicitly requires a published case and either an existing active
opposition assignment or one of the existing question/quality/statistics staff
permissions. Link visibility additionally requires access to the question itself.
No assignments, existing question policies or audited answer keys are changed.
A trigger rejects cross-opposition or non-specific question links.

## Initial import and verification (24 November 2026)

The referenced ZIP was unavailable on this machine. The original attached PDF was
available and was used instead. Seven statements were extracted from pages
102–118. The map (page 103) and three graph rows including their accompanying
percentages (page 109) were cropped directly from the PDF at 216 dpi. They were
not redrawn. The original stored images are preserved; map rotation is a display
transform that embeds the same PNG in an SVG viewport.

Case question counts: 6, 8, 6, 8, 6, 6, 1. Existing numbers 460–500 map to primary
keys 5608–5648 in the specific Organización bank. The combined full-row MD5 before
and after import is `e586df7f97b10aa332cc2d6fcd964a64`. No `preguntas` row was updated.
All four PNG SHA-256 hashes were verified against the bytes stored in Supabase.
Draft visibility was zero. An assigned learner could read 7 cases, 41 links,
4 assets and 25 chunks; an unassigned subject could read zero of each. Anonymous
SELECT and student INSERT/UPDATE/DELETE privileges are absent on every table.

The GitHub repository was reported public by the connected API. Neither the PDF,
statements, PNGs, import payloads nor account identifiers are committed here.
The schema migration contains no teaching material. Content import was executed
separately through the authorized database connection and published only after
completeness and integrity checks.

Existing test failures were reproduced on the untouched base commit. Only test
fixtures were repaired: Windows line endings in the Edge handler harness, an
obsolete curriculum-specific audit-marker expectation, and a time-dependent
memory test now supplied with its fixed reference date. Production grading and
statistics logic are unchanged.

Security Advisor also reports existing findings in unrelated views/functions and
Auth configuration. Those are outside this change; no new module object appears
in the findings. This change is not a full audit of the entire database.
