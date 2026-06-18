import { AlertTriangle, BookOpen, CheckCircle2, Info, Lightbulb } from 'lucide-react';
import HighlightableText, { type TextHighlight } from './HighlightableText';

type EditorialTone = 'basis' | 'answer' | 'exam' | 'nuance' | 'note';

type EditorialExplanationProps = {
  text: string | null | undefined;
  highlights?: TextHighlight[];
  onAddHighlight?: (highlight: Omit<TextHighlight, 'id'>) => void;
  onRemoveHighlight?: (id: string) => void;
  readOnly?: boolean;
  emptyLabel?: string;
  maxSelectionChars?: number;
};

type ExplanationSection = {
  tone: EditorialTone;
  title: string;
  text: string;
  startIndex: number;
  endIndex: number;
};

const SECTION_META: Record<
  EditorialTone,
  {
    icon: typeof Info;
    labelClass: string;
    boxClass: string;
  }
> = {
  basis: {
    icon: BookOpen,
    labelClass: 'text-slate-500',
    boxClass: 'border-slate-200 bg-white',
  },
  answer: {
    icon: CheckCircle2,
    labelClass: 'text-emerald-700',
    boxClass: 'border-emerald-200 bg-emerald-50/70',
  },
  exam: {
    icon: AlertTriangle,
    labelClass: 'text-amber-700',
    boxClass: 'border-amber-200 bg-amber-50/80',
  },
  nuance: {
    icon: Lightbulb,
    labelClass: 'text-indigo-700',
    boxClass: 'border-indigo-200 bg-indigo-50/70',
  },
  note: {
    icon: Info,
    labelClass: 'text-slate-600',
    boxClass: 'border-slate-200 bg-white',
  },
};

const stripSectionPrefix = (value: string, tone: EditorialTone) => {
  if (tone === 'exam') {
    return value.replace(/^\s*(?:⚠️|⚠|!)?\s*Ojo\s+de\s+examen\s*:\s*/i, '').trim();
  }
  if (tone === 'nuance') {
    return value.replace(/^\s*(?:💡|🧠|\*)?\s*Matiz\s+importante\s*:\s*/i, '').trim();
  }
  return value.trim();
};

const trimSection = (
  source: string,
  startIndex: number,
  endIndex: number,
  tone: EditorialTone,
  title: string,
): ExplanationSection | null => {
  let start = startIndex;
  let end = endIndex;
  while (start < end && /\s/.test(source[start] ?? '')) start += 1;
  while (end > start && /\s/.test(source[end - 1] ?? '')) end -= 1;
  if (end <= start) return null;

  const raw = source.slice(start, end);
  const text = stripSectionPrefix(raw, tone);
  if (!text) return null;
  const strippedPrefixLength = raw.indexOf(text);
  const displayStart = strippedPrefixLength > 0 ? start + strippedPrefixLength : start;

  return {
    tone,
    title,
    text,
    startIndex: displayStart,
    endIndex: displayStart + text.length,
  };
};

const firstMatchIndex = (source: string, pattern: RegExp) => {
  const match = pattern.exec(source);
  return match?.index ?? -1;
};

const splitPlainParagraphs = (source: string): ExplanationSection[] => {
  const paragraphs = source
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (paragraphs.length <= 1) {
    return [
      {
        tone: 'note',
        title: 'Lectura clave',
        text: source.trim(),
        startIndex: source.indexOf(source.trim()),
        endIndex: source.indexOf(source.trim()) + source.trim().length,
      },
    ];
  }

  let cursor = 0;
  return paragraphs.flatMap((paragraph, index) => {
    const start = source.indexOf(paragraph, cursor);
    if (start < 0) return [];
    cursor = start + paragraph.length;
    return [
      {
        tone: index === 0 ? 'basis' : 'note',
        title: index === 0 ? 'Fundamento' : 'Desarrollo',
        text: paragraph,
        startIndex: start,
        endIndex: start + paragraph.length,
      },
    ];
  });
};

const parseExplanationSections = (source: string): ExplanationSection[] => {
  const normalized = source.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const markerCandidates = [
    {
      tone: 'answer' as const,
      title: 'Respuesta',
      index: firstMatchIndex(normalized, /La\s+respuesta\s+correcta\s+es\b/i),
    },
    {
      tone: 'exam' as const,
      title: 'Ojo de examen',
      index: firstMatchIndex(normalized, /(?:⚠️|⚠)?\s*Ojo\s+de\s+examen\s*:/i),
    },
    {
      tone: 'nuance' as const,
      title: 'Matiz importante',
      index: firstMatchIndex(normalized, /(?:💡|🧠)?\s*Matiz\s+importante\s*:/i),
    },
  ]
    .filter((marker) => marker.index >= 0)
    .sort((left, right) => left.index - right.index);

  if (markerCandidates.length === 0) return splitPlainParagraphs(normalized);

  const sections: ExplanationSection[] = [];
  const firstMarker = markerCandidates[0];
  const basis = trimSection(normalized, 0, firstMarker.index, 'basis', 'Fundamento jurídico');
  if (basis) sections.push(basis);

  for (let index = 0; index < markerCandidates.length; index += 1) {
    const marker = markerCandidates[index];
    const next = markerCandidates[index + 1];
    const section = trimSection(
      normalized,
      marker.index,
      next?.index ?? normalized.length,
      marker.tone,
      marker.title,
    );
    if (section) sections.push(section);
  }

  return sections.length > 0 ? sections : splitPlainParagraphs(normalized);
};

const getSectionHighlights = (section: ExplanationSection, highlights: TextHighlight[]) =>
  highlights.flatMap((highlight) => {
    const start = Math.max(highlight.startIndex, section.startIndex);
    const end = Math.min(highlight.endIndex, section.endIndex);
    if (end <= start) return [];
    return [
      {
        ...highlight,
        startIndex: start - section.startIndex,
        endIndex: end - section.startIndex,
      },
    ];
  });

export default function EditorialExplanation({
  text,
  highlights = [],
  onAddHighlight,
  onRemoveHighlight,
  readOnly = true,
  emptyLabel = 'Sin explicación disponible.',
  maxSelectionChars = 160,
}: EditorialExplanationProps) {
  const source = String(text ?? '').trim();
  if (!source) {
    return <div className="text-sm font-bold text-slate-500">{emptyLabel}</div>;
  }

  const sections = parseExplanationSections(source);

  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const meta = SECTION_META[section.tone];
        const Icon = meta.icon;
        return (
          <section
            key={`${section.tone}-${section.startIndex}-${index}`}
            className={`rounded-2xl border px-4 py-4 ${meta.boxClass}`}
          >
            <div className={`mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] ${meta.labelClass}`}>
              <Icon size={15} />
              {section.title}
            </div>
            <div className="text-[15px] font-semibold leading-relaxed text-slate-700">
              <HighlightableText
                text={section.text}
                highlights={getSectionHighlights(section, highlights)}
                onAddHighlight={(highlight) =>
                  onAddHighlight?.({
                    ...highlight,
                    startIndex: highlight.startIndex + section.startIndex,
                    endIndex: highlight.endIndex + section.startIndex,
                  })
                }
                onRemoveHighlight={(id) => onRemoveHighlight?.(id)}
                readOnly={readOnly}
                maxSelectionChars={maxSelectionChars}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
