import type { OfficialPastQuestion, OfficialPastQuestionArticleLink } from '../../types/officialPastQuestions';
import EditorialExplanation from '../EditorialExplanation';

const optionLabels = ['a', 'b', 'c', 'd'] as const;

export default function OfficialQuestionCard({
  question,
  articleLinks = [],
}: {
  question: OfficialPastQuestion;
  articleLinks?: OfficialPastQuestionArticleLink[];
}) {
  const answer = question.normalized_answer ?? question.official_answer;
  const sourceLine = [question.source_institution, question.source_year, question.source_body].filter(Boolean).join(' · ');
  const articleLabel = articleLinks.length > 0
    ? articleLinks.map((link) => `Art. ${link.article_number}`).join(', ')
    : null;

  return (
    <article className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
          OFICIAL
        </span>
        {question.explanation_editorial ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
            Revisada con nota
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
            Pendiente explicación
          </span>
        )}
      </div>

      <div className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        {sourceLine}
        {question.source_theme_number ? ` · Tema ${question.source_theme_number}` : ''}
        {` · Pregunta ${question.official_question_number}`}
      </div>
      <div className="mt-2 text-sm font-bold text-slate-500">
        {[question.law_short_title ?? question.law_title, articleLabel].filter(Boolean).join(' · ')}
      </div>

      <h3 className="mt-4 text-lg font-black leading-snug text-slate-950">{question.question_text}</h3>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {optionLabels.map((option) => {
          const text = question[`option_${option}`];
          const correct = option === answer;
          return (
            <div
              key={option}
              className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                correct ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-100 bg-slate-50 text-slate-700'
              }`}
            >
              <span className="mr-2 font-black uppercase">{option}</span>
              {text}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Respuesta oficial</div>
        <div className="mt-1 text-sm font-black uppercase text-slate-900">{answer}</div>
      </div>

      <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">Explicación editorial</div>
        <div className="mt-2">
          <EditorialExplanation text={question.explanation_editorial ?? ''} emptyLabel="Pendiente de explicación editorial." />
        </div>
      </div>

      <div className="mt-4 text-xs font-bold leading-relaxed text-slate-500">
        Fuente: {question.source_title}
        {question.license_label ? ` · Licencia: ${question.license_label}` : ''}
        {question.source_page ? ` · Página ${question.source_page}` : ''}
      </div>
    </article>
  );
}
