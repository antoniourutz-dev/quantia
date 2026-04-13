import { supabase } from './supabaseClient';
import {
  mapAccountIdentity,
  mapCategoryRiskSummary,
  mapLearningDashboard,
  mapLearningDashboardV2,
  mapPressureInsights,
  mapPressureInsightsV2,
  mapQuestion,
  mapSession,
  readNumber,
  readText,
} from './quantiaMappers';
import type {
  AccountIdentity,
  ActivePracticeSession,
  CloudPracticeState,
  PracticeCategoryRiskSummary,
  PracticeExamTarget,
  PracticeQuestionScopeFilter,
  Question,
  TestAnswer,
} from '../types';

export const DEFAULT_CURRICULUM = 'osakidetza_admin';

export type DashboardBundle = {
  identity: AccountIdentity;
  practiceState: CloudPracticeState;
  questionsCount: number;
  weakCategories: PracticeCategoryRiskSummary[];
};

const mapPracticeCloudError = (error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}) => {
  const message = String(error.message ?? '');
  const normalizedMessage = message.toLowerCase();

  if (error.code === '42501' || normalizedMessage.includes('not_authenticated')) {
    return 'La sesion ha caducado. Vuelve a iniciar sesion.';
  }
  if (normalizedMessage.includes('could not find the function')) {
    return 'Faltan RPCs del backend de practica en Supabase. Revisa las migraciones.';
  }
  return message || 'No se ha podido completar la operacion.';
};

const isSchemaCacheSignatureError = (error: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}) => {
  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return message.includes('could not find the function') || message.includes('schema cache');
};

const getAccessTokenForFunctionsInvoke = async () => {
  const {
    data: { session: initialSession },
    error,
  } = await supabase.auth.getSession();
  let session = initialSession;

  if (error || !session?.access_token) {
    throw new Error('No hay sesion activa. Inicia sesion de nuevo para guardar el progreso.');
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs < Date.now() + 90_000) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) {
      session = refreshed.session;
    }
  }

  if (!session?.access_token) {
    throw new Error('No se ha podido refrescar la sesion. Inicia sesion de nuevo.');
  }

  return session.access_token;
};

export const getMyAccountIdentity = async (): Promise<AccountIdentity> => {
  const { data, error } = await supabase.schema('app').rpc('get_my_account_identity').maybeSingle();
  if (error) throw new Error(mapPracticeCloudError(error));

  const identity = mapAccountIdentity(data);
  if (!identity) throw new Error('No se ha podido cargar la identidad de la cuenta.');
  return identity;
};

export const getMyPracticeState = async (
  curriculum = DEFAULT_CURRICULUM,
): Promise<CloudPracticeState> => {
  const [
    { data: sessionsData, error: sessionsError },
    { data: learningDashboardData, error: learningDashboardError },
    { data: examTargetData, error: examTargetError },
    { data: pressureInsightsData, error: pressureInsightsError },
  ] = await Promise.all([
    supabase
      .schema('app')
      .from('practice_sessions')
      .select('session_id, mode, title, started_at, finished_at, score, total')
      .eq('curriculum', curriculum)
      .order('finished_at', { ascending: false })
      .limit(250),
    supabase.schema('app').rpc('get_readiness_dashboard', { p_curriculum: curriculum }).maybeSingle(),
    supabase.schema('app').rpc('get_my_exam_target', { p_curriculum: curriculum }).maybeSingle(),
    supabase.schema('app').rpc('get_pressure_dashboard', { p_curriculum: curriculum }).maybeSingle(),
  ]);

  if (sessionsError) throw new Error(mapPracticeCloudError(sessionsError));

  const examTarget =
    examTargetData && typeof examTargetData === 'object'
      ? {
          userId: String((examTargetData as Record<string, unknown>)['user_id'] ?? ''),
          curriculum: String((examTargetData as Record<string, unknown>)['curriculum'] ?? curriculum),
          examDate: readText((examTargetData as Record<string, unknown>)['exam_date']),
          dailyReviewCapacity: readNumber(
            (examTargetData as Record<string, unknown>)['daily_review_capacity'],
            35,
          ),
          dailyNewCapacity: readNumber(
            (examTargetData as Record<string, unknown>)['daily_new_capacity'],
            10,
          ),
          updatedAt: readText((examTargetData as Record<string, unknown>)['updated_at']),
        }
      : null;

  return {
    recentSessions: ((sessionsData ?? []) as Array<Record<string, unknown>>).map(mapSession),
    learningDashboard: learningDashboardError
      ? null
      : mapLearningDashboard((learningDashboardData ?? null) as Record<string, unknown> | null),
    learningDashboardV2: null,
    examTarget: examTargetError ? null : examTarget,
    pressureInsights: pressureInsightsError
      ? null
      : mapPressureInsights((pressureInsightsData ?? null) as Record<string, unknown> | null),
    pressureInsightsV2: null,
  };
};

export const getMyLearningDashboardV2 = async (curriculum = DEFAULT_CURRICULUM) => {
  const { data, error } = await supabase
    .schema('app')
    .rpc('get_readiness_dashboard_v2', { p_curriculum: curriculum })
    .maybeSingle();

  if (error) throw new Error(mapPracticeCloudError(error));
  return mapLearningDashboardV2((data ?? null) as Record<string, unknown> | null);
};

export const getMyPressureDashboardV2 = async (curriculum = DEFAULT_CURRICULUM) => {
  const { data, error } = await supabase
    .schema('app')
    .rpc('get_pressure_dashboard_v2', { p_curriculum: curriculum })
    .maybeSingle();

  if (error) throw new Error(mapPracticeCloudError(error));
  return mapPressureInsightsV2((data ?? null) as Record<string, unknown> | null);
};

export const getPracticeCatalogSummary = async (
  curriculum = DEFAULT_CURRICULUM,
  questionScope: PracticeQuestionScopeFilter = 'all',
) => {
  const { data, error } = await supabase
    .schema('app')
    .rpc('get_practice_catalog_summary', {
      p_curriculum: curriculum,
      p_question_scope: questionScope,
    })
    .maybeSingle();

  if (error) throw new Error(mapPracticeCloudError(error));
  return {
    totalQuestions: readNumber((data as Record<string, unknown> | null)?.total_questions),
  };
};

export const getWeakCategorySummary = async (
  curriculum = DEFAULT_CURRICULUM,
  limit = 5,
  questionScope: PracticeQuestionScopeFilter = 'all',
) => {
  const { data, error } = await supabase.schema('app').rpc('get_category_risk_dashboard', {
    p_curriculum: curriculum,
    p_limit: limit,
    p_question_scope: questionScope,
  });

  if (error) throw new Error(mapPracticeCloudError(error));
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapCategoryRiskSummary);
};

export const getRandomPracticeBatch = async (
  batchSize: number,
  curriculum = DEFAULT_CURRICULUM,
  questionScope: PracticeQuestionScopeFilter = 'all',
) => {
  const { data, error } = await supabase.schema('app').rpc('get_random_practice_batch', {
    p_curriculum: curriculum,
    p_batch_size: batchSize,
    p_question_scope: questionScope,
  });

  if (error) throw new Error(mapPracticeCloudError(error));

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const payload =
        row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : row;
      return mapQuestion(payload);
    })
    .filter((question): question is Question => Boolean(question));
};

export const getWeakPracticeBatch = async (
  batchSize: number,
  curriculum = DEFAULT_CURRICULUM,
  questionScope: PracticeQuestionScopeFilter = 'all',
) => {
  const rpcAttempts = [
    { p_curriculum: curriculum, p_limit: batchSize, p_question_scope: questionScope },
    { p_curriculum: curriculum, p_batch_size: batchSize, p_question_scope: questionScope },
  ];

  let lastError: {
    code?: string | null;
    message?: string | null;
    details?: string | null;
    hint?: string | null;
  } | null = null;

  for (const params of rpcAttempts) {
    const { data, error } = await supabase.schema('app').rpc('get_weak_practice_batch', params);

    if (!error) {
      return ((data ?? []) as Array<Record<string, unknown>>)
        .map((row) => {
          const payload =
            row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
              ? (row.payload as Record<string, unknown>)
              : row;
          return mapQuestion(payload);
        })
        .filter((question): question is Question => Boolean(question));
    }

    lastError = error;
    if (!isSchemaCacheSignatureError(error)) {
      break;
    }
  }

  throw new Error(
    mapPracticeCloudError(
      lastError ?? { message: 'No se ha podido cargar el repaso de fallos.' },
    ),
  );
};

export const getStudyQuestionsSlice = async (
  limit = 150,
  offset = 0,
  curriculum = DEFAULT_CURRICULUM,
): Promise<Question[]> => {
  const rpcAttempts = [
    { p_curriculum: curriculum, p_limit: limit, p_offset: offset },
    { p_curriculum: curriculum, p_batch_size: limit, p_offset: offset },
  ];

  for (const params of rpcAttempts) {
    const { data, error } = await supabase.schema('app').rpc('get_study_questions', params);
    if (!error) {
      return ((data ?? []) as Array<Record<string, unknown>>)
        .map((row) => {
          const payload =
            row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
              ? (row.payload as Record<string, unknown>)
              : row;
          return mapQuestion(payload);
        })
        .filter((question): question is Question => Boolean(question));
    }
    if (!isSchemaCacheSignatureError(error)) {
      break;
    }
  }

  const tables = ['study_questions', 'questions', 'practice_questions', 'question_bank', 'oposicion_questions'];
  for (const table of tables) {
    const { data, error } = await supabase
      .schema('app')
      .from(table)
      .select('*')
      .range(offset, Math.max(offset, offset + limit - 1));

    if (!error) {
      return ((data ?? []) as Array<Record<string, unknown>>)
        .map(mapQuestion)
        .filter((question): question is Question => Boolean(question));
    }

    const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
    if (!message.includes('does not exist') && !message.includes('relation') && error.code !== '42P01') {
      break;
    }
  }

  return getRandomPracticeBatch(limit, curriculum, 'all');
};

export const updateMyExamTarget = async (input: {
  curriculum: string;
  examDate: string | null;
  dailyReviewCapacity: number;
  dailyNewCapacity: number;
}): Promise<PracticeExamTarget> => {
  const { curriculum, examDate, dailyReviewCapacity, dailyNewCapacity } = input;

  const payloadA = {
    p_curriculum: curriculum,
    p_exam_date: examDate,
    p_daily_review_capacity: dailyReviewCapacity,
    p_daily_new_capacity: dailyNewCapacity,
  };
  const payloadB = {
    p_curriculum: curriculum,
    p_exam_date: examDate,
    p_review_capacity: dailyReviewCapacity,
    p_new_capacity: dailyNewCapacity,
  };

  const rpcNames = ['set_my_exam_target', 'upsert_my_exam_target', 'update_my_exam_target'];
  const payloads = [payloadA, payloadB];

  for (const rpcName of rpcNames) {
    for (const rpcPayload of payloads) {
      const { data, error } = await supabase.schema('app').rpc(rpcName, rpcPayload).maybeSingle();
      if (!error) {
        const target = data && typeof data === 'object'
          ? {
              userId: String((data as Record<string, unknown>)['user_id'] ?? ''),
              curriculum: String((data as Record<string, unknown>)['curriculum'] ?? curriculum),
              examDate: readText((data as Record<string, unknown>)['exam_date']),
              dailyReviewCapacity: readNumber(
                (data as Record<string, unknown>)['daily_review_capacity'] ??
                  (data as Record<string, unknown>)['p_daily_review_capacity'],
                dailyReviewCapacity,
              ),
              dailyNewCapacity: readNumber(
                (data as Record<string, unknown>)['daily_new_capacity'] ??
                  (data as Record<string, unknown>)['p_daily_new_capacity'],
                dailyNewCapacity,
              ),
              updatedAt: readText((data as Record<string, unknown>)['updated_at']),
            }
          : null;
        if (target) return target;
        return {
          userId: '',
          curriculum,
          examDate,
          dailyReviewCapacity,
          dailyNewCapacity,
          updatedAt: new Date().toISOString(),
        };
      }

      if (!isSchemaCacheSignatureError(error)) {
        break;
      }
    }
  }

  throw new Error('No se ha podido guardar el objetivo de examen (RPC no disponible en Supabase).');
};

export const buildRandomPracticeSession = (questions: Question[]): ActivePracticeSession => ({
  id: crypto.randomUUID(),
  mode: 'random',
  title: 'Sesion aleatoria',
  startedAt: new Date().toISOString(),
  questions,
  batchNumber: 1,
  totalBatches: 1,
  batchStartIndex: null,
  nextStandardBatchStartIndex: null,
});

export const recordPracticeSessionInCloud = async (
  session: ActivePracticeSession,
  answers: TestAnswer[],
  curriculum = DEFAULT_CURRICULUM,
) => {
  const attempts = answers
    .map((answer) => {
      const question = session.questions.find((item) => item.id === answer.questionId);
      if (!question) return null;

      return {
        question_id: question.id,
        question_number: question.number,
        statement: question.text,
        category: question.category,
        question_scope: question.questionScope,
        explanation: question.explanation,
        selected_option: answer.selectedOption,
        correct_option: answer.correctOption,
        is_correct: answer.isCorrect,
        answered_at: answer.answeredAt,
        response_time_ms: answer.responseTimeMs,
        time_to_first_selection_ms: answer.timeToFirstSelectionMs,
        changed_answer: answer.changedAnswer,
        error_type_inferred: null,
      };
    })
    .filter(Boolean);

  const accessToken = await getAccessTokenForFunctionsInvoke();
  const { data, error } = await supabase.functions.invoke('sync-practice-session', {
    body: {
      session: {
        id: session.id,
        mode: session.mode,
        title: session.title,
        startedAt: session.startedAt,
        batchNumber: session.batchNumber,
        batchSize: session.questions.length,
        batchStartIndex: session.batchStartIndex,
        nextStandardBatchStartIndex: session.nextStandardBatchStartIndex,
      },
      attempts,
      curriculum,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) throw new Error(mapPracticeCloudError(error));
  return data;
};

export const loadDashboardBundle = async (
  curriculum = DEFAULT_CURRICULUM,
): Promise<DashboardBundle> => {
  const [identity, practiceState, learningDashboardV2, pressureInsightsV2, catalog, weakCategories] =
    await Promise.all([
      getMyAccountIdentity(),
      getMyPracticeState(curriculum),
      getMyLearningDashboardV2(curriculum),
      getMyPressureDashboardV2(curriculum),
      getPracticeCatalogSummary(curriculum),
      getWeakCategorySummary(curriculum, 5),
    ]);

  return {
    identity,
    practiceState: {
      ...practiceState,
      learningDashboardV2,
      pressureInsightsV2,
    },
    questionsCount: catalog.totalQuestions,
    weakCategories,
  };
};

export const signOut = async () => {
  await supabase.auth.signOut();
};
