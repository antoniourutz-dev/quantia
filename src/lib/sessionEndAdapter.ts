import type { FinishedTestPayload, PracticeMode } from '../types';
import type { CopyLocale, SurfaceCopyState } from './coachCopyV2';
import { pickMicroReward } from './microRewards';

export type SessionEndDecision = {
  dominantState: SurfaceCopyState;
  dominantTitle: string;
  dominantBody: string;
  primaryCta: string;
  microReward: { title: string; detail: string } | null;
};

export const buildSessionEndDecision = (input: {
  locale: CopyLocale;
  payload: FinishedTestPayload;
  questionsCount: number;
  mode: PracticeMode;
  curriculum: string;
  username?: string | null;
  didReturnAfterGap: boolean;
}): SessionEndDecision => {
  const isBasque = input.locale === 'eu';
  const t = (es: string, eu: string) => isBasque ? eu : es;

  const total = Math.max(input.questionsCount, 1);
  const accuracy = input.payload.score / total;
  
  // Calculate Avg Time to sense "Impulsive" reading
  const avgTimeMs = input.payload.answers.length > 0
    ? input.payload.answers.reduce((acc, curr) => acc + (curr.responseTimeMs ?? 0), 0) / input.payload.answers.length
    : 0;
  const avgTimeSec = avgTimeMs / 1000;

  let state: SurfaceCopyState = 'gray_zone';
  let variantCategory: 'mala' | 'simulacro_flojo' | 'impulse' | 'recovery' | 'irregular' | 'buena' | 'excelente' = 'irregular';

  // 1. Matrix State Resolution (Strict Hierarchy)
  if (input.didReturnAfterGap && accuracy >= 0.40) {
    state = 'low_momentum';
    variantCategory = 'recovery';
  } else if (input.mode === 'simulacro' && accuracy < 0.6) {
    state = 'pressure_instability';
    variantCategory = 'simulacro_flojo';
  } else if (accuracy < 0.6 && avgTimeSec > 0 && avgTimeSec < 7.5) {
    // Sarcasmo/Firmeza: Too fast and failing
    state = 'repeated_errors';
    variantCategory = 'impulse';
  } else if (accuracy < 0.50) {
    state = 'recovery_needed';
    variantCategory = 'mala';
  } else if (accuracy < 0.70) {
    state = 'memory_instability';
    variantCategory = 'irregular';
  } else if (accuracy < 0.88) {
    state = 'stable_accuracy';
    variantCategory = 'buena';
  } else {
    state = 'momentum_up';
    variantCategory = 'excelente';
  }

  // 2. Direct Executive Copy Matrix
  const copyMatrix: Record<typeof variantCategory, Array<{t: string, b: string}>> = {
    mala: [
      { t: t('Esto no ha estado bien.', 'Hau ez da ondo egon.'), b: t('Has fallado demasiado en cosas corregibles.', 'Zuzendu daitezkeen gauzetan gehiegi huts egin duzu.') },
      { t: t('Aquí ha faltado control.', 'Hemen kontrola falta izan da.'), b: t('Sesión muy floja. Toca corregir urgentemente cómo estás entrando a las preguntas.', 'Saio ahula. Premiazkoa da galderetara nola sartzen zaren zuzentzea.') },
      { t: t('El nivel ha caído.', 'Mailak behera egin du.'), b: t('Aquí no ha faltado suerte. Ha faltado precisión y asegurar la base.', 'Hemen ez da zortea falta izan. Zehaztasuna falta izan da.') }
    ],
    simulacro_flojo: [
      { t: t('Bajo presión te has caído.', 'Presiopean behera egin duzu.'), b: t('Sabes más de lo que aquí has conseguido demostrar. Toca estabilizar.', 'Hemen erakutsi duzuna baino gehiago dakizu. Egonkortzea tokatzen da.') },
      { t: t('Demasiadas fisuras cruzadas.', 'Zirrikitu gehiegi gurutzatuta.'), b: t('Así todavía no compites bien. Conviene bajar revoluciones.', 'Horrela oraindik ez daukazu mailarik. Erritmoa jaitsi behar da.') }
    ],
    impulse: [
      { t: t('Has corrido más que pensado.', 'Pentsatu baino gehiago korrika egin duzu.'), b: t('Leer los detalles dos segundos más no era delito.', 'Xehetasunak bi segundo gehiagoz irakurtzea ez zen delitua.') },
      { t: t('Aceleración sin control.', 'Aiadura kontrolik gabe.'), b: t('Muy valiente la velocidad de respuesta. Muy pobre el resultado.', 'Oso ausarta erantzuteko abiadura. Oso pobrea emaitza.') },
      { t: t('Trampas no tan ocultas.', 'Tranpak ez hain ezkutuan.'), b: t('La trampa del enunciado no estaba enterrada. No has querido mirar bien.', 'Galderaren tranpa ez zegoen lur azpian. Ez duzu ondo begiratu nahi izan.') }
    ],
    recovery: [
      { t: t('Has vuelto. Eso era lo crítico.', 'Itzuli zara. Hori zen funtsezkoa.'), b: t('No era día de sacar brillo a la nota; era día de aparecer y cumplir.', 'Ez zen distira ateratzeko eguna; agertzeko eta betetzeko eguna zen.') },
      { t: t('El paso más duro está dado.', 'Pausorik zailena emanda dago.'), b: t('Aparecer hoy tras la desconexión cuenta doble. Ahora recuperaremos precisión.', 'Gaur berriro agertzeak bikoitza balio du. Orain zehaztasuna berreskuratuko dugu.') }
    ],
    irregular: [
      { t: t('Hay base, mal rematada.', 'Oinarria dago, gaizki amaituta.'), b: t('Has salvado parte del test, pero no puedes dar esto por bueno.', 'Zati bat salbatu duzu, baina ezin duzu emaitza hau ontzat eman.') },
      { t: t('Paso irregular.', 'Pauso irregularra.'), b: t('No es un desastre completo, pero tampoco es un paso limpio en el que confiar.', 'Ez da erabateko hondamendia, baina ez da pauso garbia konfiantza izateko.') }
    ],
    buena: [
      { t: t('Hoy sí has estado serio.', 'Gaur, aldiz, serio aritu zara.'), b: t('La lectura limpia da sus frutos. Estás cogiendo buen poso hoy.', 'Irakurketa garbiak fruituak ematen ditu. Asko hobetzen ari zara.') },
      { t: t('Aquí ya hay control pleno.', 'Hemen badago kontrola jada.'), b: t('Buena sesión de verdad, por la forma en la que has defendido el resultado.', 'Benetan saio ona, emaitza nola defendatu duzun ikusita.') }
    ],
    excelente: [
      { t: t('Resultados ejecutivos.', 'Emaitza exekutiboak.'), b: t('Un porcentaje así raramente es suerte. Es dominio directo del material.', 'Horrelako ehuneko bat ez da zortea. Materiala menderatzea da.') },
      { t: t('Nivel competitivo superado.', 'Maila lehiakorra gaindituta.'), b: t('No voy a añadir mucho hoy. Estás un nivel por encima en esta ronda.', 'Gaur ez dut askoz gehiago komentatuko. Puntu bat gorago zaude gaur.') }
    ]
  };

  const pool = copyMatrix[variantCategory];
  // Stable deterministic random based on score and question count
  const seedString = `${input.curriculum}:${input.payload.score}:${input.questionsCount}:${variantCategory}`;
  let hash = 2166136261;
  for (let i = 0; i < seedString.length; i++) {
    hash ^= seedString.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const stableIndex = Math.abs(hash >>> 0) % pool.length;
  const copy = pool[stableIndex];

  // Specific internal generic CTA mapped by tone
  const baseCtas: Record<typeof variantCategory, string> = {
    mala: t('Enfocar fallos', 'Hutsak ikusi'),
    simulacro_flojo: t('Cubrir fisuras', 'Zirrikituak estali'),
    impulse: t('Frenar y revisar', 'Gelditu eta errepasatu'),
    recovery: t('Asegurar bloque', 'Blokea ziurtatu'),
    irregular: t('Rematar mejor', 'Hobeto amaitu'),
    buena: t('Sostener firmeza', 'Sendotasunari eutsi'),
    excelente: t('Cobrar y seguir', 'Gorde eta jarraitu')
  };

  const microReward = pickMicroReward({
    locale: input.locale,
    sessionState: state,
    didReturnAfterGap: input.didReturnAfterGap,
    trainedPressure: input.mode === 'simulacro',
    reducedPending: state === 'consistency_risk',
  }, seedString);

  return {
    dominantState: state,
    dominantTitle: copy.t,
    dominantBody: copy.b,
    primaryCta: baseCtas[variantCategory],
    microReward: microReward ? { title: microReward.title, detail: microReward.detail } : null,
  };
};
