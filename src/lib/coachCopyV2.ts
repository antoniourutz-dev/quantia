import type { CoachPlanV2 } from './coach';
import type { DashboardBundle } from './quantiaApi';
import type { FinishedTestPayload, PracticeMode, PracticeSessionSummary } from '../types';

export type CopyLocale = 'es' | 'eu';
export type SurfaceCopyState =
  | 'high_backlog'
  | 'repeated_errors'
  | 'pressure_instability'
  | 'recovery_needed'
  | 'low_momentum'
  | 'consistency_risk'
  | 'memory_instability'
  | 'stable_accuracy'
  | 'momentum_up'
  | 'gray_zone';

export type CopyRegister = 'standard' | 'firm' | 'sharp' | 'push';

export type SurfaceCopyVariant = {
  register?: CopyRegister;
  eyebrow?: { es: string; eu: string };
  line1: { es: string; eu: string };
  line2?: { es: string; eu: string };
  cta?: { es: string; eu: string };
};

export type SurfaceCopySet = {
  homeHero: SurfaceCopyVariant[];
  homeCard: SurfaceCopyVariant[];
  statsSummary: SurfaceCopyVariant[];
  reviewIntro: SurfaceCopyVariant[];
  sessionEnd: SurfaceCopyVariant[];
};

type CopySurface = keyof SurfaceCopySet;

const localize = (text: { es: string; eu: string } | undefined, locale: CopyLocale) =>
  text ? (locale === 'eu' ? text.eu : text.es) : undefined;

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const chooseStableVariant = <T,>(variants: T[], seed: string) =>
  variants[hashString(seed) % Math.max(variants.length, 1)] ?? variants[0];

const getAllowedRegisters = (state: SurfaceCopyState): CopyRegister[] => {
  switch (state) {
    case 'high_backlog':
      return ['standard', 'firm', 'sharp'];
    case 'repeated_errors':
      return ['standard', 'firm', 'sharp'];
    case 'pressure_instability':
      return ['standard', 'firm'];
    case 'consistency_risk':
      return ['standard', 'firm'];
    case 'momentum_up':
      return ['standard', 'push'];
    case 'stable_accuracy':
      return ['standard', 'push'];
    case 'recovery_needed':
    case 'low_momentum':
    case 'memory_instability':
    case 'gray_zone':
    default:
      return ['standard'];
  }
};

const getAllowedRegistersForSurface = (
  state: SurfaceCopyState,
  surface: CopySurface,
): CopyRegister[] => {
  const base = getAllowedRegisters(state);

  // En stats conviene menos filo y más lectura seria.
  if (surface === 'statsSummary') {
    return base.filter((register) => register !== 'sharp');
  }

  // En review conviene firmeza, pero poca retranca.
  if (surface === 'reviewIntro') {
    return base.filter((register) => register !== 'sharp');
  }

  return base;
};

const resolveRegister = ({
  state,
  surface,
  seed,
}: {
  state: SurfaceCopyState;
  surface: CopySurface;
  seed: string;
}): CopyRegister => {
  const allowed = getAllowedRegistersForSurface(state, surface);
  return chooseStableVariant(allowed, `register:${surface}:${state}:${seed}`) ?? 'standard';
};


const daysSinceLastSession = (recentSessions: PracticeSessionSummary[]) => {
  const sorted = [...recentSessions].sort((left, right) => {
    const leftTime = Date.parse(left.finishedAt || left.startedAt || '') || 0;
    const rightTime = Date.parse(right.finishedAt || right.startedAt || '') || 0;
    return rightTime - leftTime;
  });

  const last = sorted[0];
  if (!last) return null;
  const timestamp = Date.parse(last.finishedAt || last.startedAt || '');
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
};

const computeRecentAccuracy = (recentSessions: PracticeSessionSummary[]) => {
  const windowSessions = [...recentSessions]
    .sort((left, right) => {
      const leftTime = Date.parse(left.finishedAt || left.startedAt || '') || 0;
      const rightTime = Date.parse(right.finishedAt || right.startedAt || '') || 0;
      return rightTime - leftTime;
    })
    .slice(0, 3);

  const totals = windowSessions.reduce(
    (acc, session) => {
      acc.score += Number(session.score ?? 0) || 0;
      acc.total += Number(session.total ?? 0) || 0;
      return acc;
    },
    { score: 0, total: 0 },
  );

  if (totals.total <= 0) return null;
  return totals.score / totals.total;
};

const computeWeeklyQuestions = (recentSessions: PracticeSessionSummary[]) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  return recentSessions.reduce((acc, session) => {
    const rawDate = session.finishedAt || session.startedAt;
    const timestamp = rawDate ? Date.parse(rawDate) : NaN;
    if (!Number.isFinite(timestamp) || timestamp < start.getTime()) return acc;
    return acc + (Number(session.total ?? 0) || 0);
  }, 0);
};

const COPY_LIBRARY: Record<SurfaceCopyState, SurfaceCopySet> = {
  high_backlog: {
  homeHero: [
    {
      register: 'standard',
      eyebrow: { es: 'Sugerencia de hoy', eu: 'Gaurko proposamena' },
      line1: { es: 'Se te están quedando repasos atrás.', eu: 'Errepaso batzuk atzean geratzen ari zaizkizu.' },
      line2: { es: 'Hoy te compensa ponerte al día antes de seguir.', eu: 'Gaur hobe duzu eguneratu eta gero jarraitu.' },
      cta: { es: 'Ponerte al día', eu: 'Eguneratzen hasi' },
    },
    {
      register: 'firm',
      eyebrow: { es: 'Siguiente paso', eu: 'Hurrengo pausoa' },
      line1: { es: 'Antes de abrir más, toca cerrar lo pendiente.', eu: 'Gehiago ireki aurretik, zintzilik dagoena ixtea tokatzen da.' },
      line2: { es: 'Si no ordenas esto ahora, el resto del estudio te va a rendir menos.', eu: 'Hau orain ordenatzen ez baduzu, gainerako ikasketak gutxiago emango dizu.' },
      cta: { es: 'Cerrar pendientes', eu: 'Zintzilik dagoena itxi' },
    },
    {
      register: 'sharp',
      eyebrow: { es: 'Lo que toca', eu: 'Tokatzen dena' },
      line1: { es: 'Mucho abrir y poco cerrar.', eu: 'Asko ireki eta gutxi itxi.' },
      line2: { es: 'Ahora no toca sumar más. Toca poner orden.', eu: 'Orain ez da gehiago pilatzeko unea. Ordena jartzekoa da.' },
      cta: { es: 'Poner orden', eu: 'Ordena jarri' },
    },
  ],
  homeCard: [
    {
      register: 'standard',
      line1: { es: 'Recoge lo que has dejado atrás', eu: 'Bildu atzean utzitakoa' },
      line2: { es: 'Si ordenas esto ahora, el resto del estudio vuelve a cundir.', eu: 'Hori orain ordenatzen baduzu, gainerako ikasketak gehiago emango du.' },
      cta: { es: 'Ir al repaso', eu: 'Errepasora joan' },
    },
    {
      register: 'firm',
      line1: { es: 'Hoy toca limpiar pendientes', eu: 'Gaur zintzilik dagoena garbitzea tokatzen da' },
      line2: { es: 'No hace falta alargarlo: hace falta cerrarlo bien.', eu: 'Ez da luzatu behar: ondo ixtea baizik.' },
      cta: { es: 'Cerrar esto', eu: 'Hau itxi' },
    },
    {
      register: 'sharp',
      line1: { es: 'Lo pendiente ya pesa demasiado', eu: 'Zintzilik dagoenak gehiegi pisatzen du jada' },
      line2: { es: 'Seguir abriendo ahora sería decorar el problema.', eu: 'Orain gehiago irekitzea arazoa apaintzea litzateke.' },
      cta: { es: 'Limpiar esto', eu: 'Hau garbitu' },
    },
  ],
  statsSummary: [
    {
      register: 'standard',
      line1: { es: 'Ahora mismo te rinde más repasar que abrir cosas nuevas.', eu: 'Une honetan gehiago ematen dizu errepasoak berria irekitzeak baino.' },
      line2: { es: 'Mientras arrastres materia, avanzar cunde menos.', eu: 'Atzetik gauzak badakartzazu, aurrera egiteak gutxiago ematen du.' },
    },
    {
      register: 'firm',
      line1: { es: 'Llevas materia pendiente acumulada.', eu: 'Pilatutako materia daukazu egiteko.' },
      line2: { es: 'Si no limpias eso primero, el avance se te diluye.', eu: 'Hori lehenengo garbitzen ez baduzu, aurrerapena lausotu egiten da.' },
    },
  ],
  reviewIntro: [
    {
      register: 'standard',
      line1: { es: 'No hace falta mirar todo otra vez.', eu: 'Ez duzu dena berriro begiratu behar.' },
      line2: { es: 'Ve a lo que más se te está quedando atrás.', eu: 'Joan gehien atzean geratzen zaizunera.' },
      cta: { es: 'Ir a lo pendiente', eu: 'Zintzilik dagoenera joan' },
    },
    {
      register: 'firm',
      line1: { es: 'Ahora toca ordenar, no dispersarse.', eu: 'Orain ordenatzea tokatzen da, ez sakabanatzea.' },
      line2: { es: 'Empieza por lo que más te está costando mantener vivo.', eu: 'Hasi bizirik mantentzea gehien kostatzen zaizunetik.' },
      cta: { es: 'Empezar por ahí', eu: 'Hortik hasi' },
    },
  ],
  sessionEnd: [
    {
      register: 'standard',
      line1: { es: 'Buen paso, pero aún queda recoger parte de lo pendiente.', eu: 'Pauso ona, baina oraindik bada zintzilik dagoena jasotzeko.' },
      line2: { es: 'Si vuelves ahora a ese repaso, te lo quitas de encima.', eu: 'Orain errepaso horretara itzultzen bazara, gainetik kenduko duzu.' },
      cta: { es: 'Seguir repasando', eu: 'Errepasoarekin jarraitu' },
    },
    {
      register: 'firm',
      line1: { es: 'La sesión suma, pero no te libra todavía de lo que arrastras.', eu: 'Saioak batzen du, baina ez zaitu oraindik atzetik daramazunetik libratzen.' },
      line2: { es: 'Rematar esto ahora te deja mucho mejor colocado.', eu: 'Hau orain bukatzeak askoz hobeto uzten zaitu.' },
      cta: { es: 'Rematar esto', eu: 'Hau amaitu' },
    },
    {
      register: 'sharp',
      line1: { es: 'Bien. Pero lo pendiente sigue ahí.', eu: 'Ondo. Baina zintzilik dagoena hor dago oraindik.' },
      line2: { es: 'Si lo cierras ahora, mañana no te vuelve a morder.', eu: 'Orain ixten baduzu, bihar ez zaitu berriz kosk egingo.' },
      cta: { es: 'Cerrar pendientes', eu: 'Zintzilik dagoena itxi' },
    },
  ],
},
  repeated_errors: {
  homeHero: [
    {
      register: 'standard',
      eyebrow: { es: 'Sugerencia de hoy', eu: 'Gaurko proposamena' },
      line1: { es: 'Hay fallos que se te están repitiendo.', eu: 'Errepikatzen ari zaizkizun hutsak daude.' },
      line2: { es: 'Hoy compensa ir a por ellos de frente.', eu: 'Gaur merezi du horiei zuzenean heltzea.' },
      cta: { es: 'Corregir esto', eu: 'Hau zuzendu' },
    },
    {
      register: 'firm',
      eyebrow: { es: 'Punto a trabajar', eu: 'Landu beharrekoa' },
      line1: { es: 'Estás tropezando varias veces en lo mismo.', eu: 'Behin baino gehiagotan ari zara gauza berean estropezu egiten.' },
      line2: { es: 'Hasta que lo corrijas bien, te va a seguir costando puntos.', eu: 'Ondo zuzendu arte, puntuak kentzen jarraituko dizu.' },
      cta: { es: 'Ir al fallo', eu: 'Hutsera joan' },
    },
    {
      register: 'sharp',
      eyebrow: { es: 'Lo que toca', eu: 'Tokatzen dena' },
      line1: { es: 'No es mala suerte: es el mismo fallo otra vez.', eu: 'Ez da zorte txarra: huts bera da berriro.' },
      line2: { es: 'Hoy toca cortarlo de raíz.', eu: 'Gaur sustraitik etetea tokatzen da.' },
      cta: { es: 'Cortar este fallo', eu: 'Hutsegite hau eten' },
    },
  ],
  homeCard: [
    {
      register: 'standard',
      line1: { es: 'Vuelve justo donde más tropiezas', eu: 'Itzuli gehien estropezu egiten duzun tokira' },
      line2: { es: 'Un repaso bien enfocado aquí te limpia muchos errores repetidos.', eu: 'Hemen ondo bideratutako errepaso batek huts errepikatu asko kentzen dizkizu.' },
      cta: { es: 'Revisar fallos', eu: 'Hutsak berrikusi' },
    },
    {
      register: 'firm',
      line1: { es: 'Corrige el patrón, no solo la pregunta', eu: 'Zuzendu eredua, ez galdera bakarrik' },
      line2: { es: 'Cuando entiendes por qué cae, deja de repetirse.', eu: 'Zergatik gertatzen den ulertzen duzunean, ez da hainbeste errepikatzen.' },
      cta: { es: 'Corregir bien', eu: 'Ondo zuzendu' },
    },
    {
      register: 'sharp',
      line1: { es: 'Aquí no falta variedad', eu: 'Hemen ez da barietatea falta' },
      line2: { es: 'Falta dejar de caer siempre en lo mismo.', eu: 'Falta da beti gauza berean ez erortzea.' },
      cta: { es: 'Ir al problema', eu: 'Arazoara joan' },
    },
  ],
  statsSummary: [
    {
      register: 'standard',
      line1: { es: 'Tus fallos no están repartidos: se concentran en pocos puntos.', eu: 'Zure hutsak ez daude sakabanatuta: puntu gutxi batzuetan pilatzen dira.' },
      line2: { es: 'Ahí es donde más te compensa entrar ahora.', eu: 'Hor sartzea da orain gehien komeni zaizuna.' },
    },
    {
      register: 'firm',
      line1: { es: 'Hay un patrón claro de error.', eu: 'Hutsegite eredu argi bat dago.' },
      line2: { es: 'Si corriges eso, el rendimiento sube sin cambiarlo todo.', eu: 'Hori zuzentzen baduzu, errendimendua igotzen da dena aldatu gabe.' },
    },
  ],
  reviewIntro: [
    {
      register: 'standard',
      line1: { es: 'No repases por encima.', eu: 'Ez errepasatu gainetik.' },
      line2: { es: 'Ve a las preguntas donde más se está repitiendo el fallo.', eu: 'Joan hutsa gehien errepikatzen den galderetara.' },
      cta: { es: 'Entrar ahí', eu: 'Hor sartu' },
    },
    {
      register: 'firm',
      line1: { es: 'Aquí no toca cantidad, toca corregir bien.', eu: 'Hemen ez da kopurua garrantzitsua: ondo zuzentzea baizik.' },
      line2: { es: 'Quédate con el por qué de cada tropiezo.', eu: 'Geratu estropezu bakoitzaren zergatiarekin.' },
      cta: { es: 'Corregir con calma', eu: 'Lasai zuzendu' },
    },
  ],
  sessionEnd: [
    {
      register: 'standard',
      line1: { es: 'Ya has visto dónde se te repite el fallo.', eu: 'Ikusi duzu non errepikatzen zaizun hutsa.' },
      line2: { es: 'Si vuelves ahí una vez más, suele quedarse mucho mejor.', eu: 'Horra beste behin itzultzen bazara, askoz hobeto gelditzen da normalean.' },
      cta: { es: 'Volver a ese punto', eu: 'Puntu horretara itzuli' },
    },
    {
      register: 'firm',
      line1: { es: 'La sesión ha dejado claro qué corregir.', eu: 'Saioak argi utzi du zer zuzendu behar den.' },
      line2: { es: 'No lo dejes para otro día si lo tienes ahora fresco.', eu: 'Ez utzi beste baterako orain fresko badaukazu.' },
      cta: { es: 'Cerrar ese fallo', eu: 'Hutsegite hori itxi' },
    },
    {
      register: 'sharp',
      line1: { es: 'Ya está señalado. Ahora toca corregirlo de verdad.', eu: 'Seinalatuta dago jada. Orain benetan zuzentzea tokatzen da.' },
      line2: { es: 'Si lo sueltas aquí, luego vuelve a salir igual.', eu: 'Hemen askatzen baduzu, gero berdin aterako da berriz.' },
      cta: { es: 'Corregir de verdad', eu: 'Benetan zuzendu' },
    },
  ],
},
  pressure_instability: {
  homeHero: [
    {
      register: 'standard',
      eyebrow: { es: 'Sugerencia de hoy', eu: 'Gaurko proposamena' },
      line1: { es: 'Cuando aprietas, tu nivel se mueve más de la cuenta.', eu: 'Presioa sartzen denean, zure maila gehiegi mugitzen da.' },
      line2: { es: 'Hoy toca coger seguridad antes de exigirte más.', eu: 'Gaur segurtasuna hartzea tokatzen da gehiago exijitu aurretik.' },
      cta: { es: 'Entrenar con control', eu: 'Kontrolarekin entrenatu' },
    },
    {
      register: 'firm',
      eyebrow: { es: 'Punto a cuidar', eu: 'Zaindu beharrekoa' },
      line1: { es: 'La base está, pero bajo presión se te cae parte del trabajo.', eu: 'Oinarria badago, baina presiopean lanaren zati bat erortzen zaizu.' },
      line2: { es: 'Antes del siguiente simulacro, esto tiene que aguantar mejor.', eu: 'Hurrengo simulakroaren aurretik, honek hobeto eutsi behar du.' },
      cta: { es: 'Sostener el nivel', eu: 'Mailari eutsi' },
    },
  ],
  homeCard: [
    {
      register: 'standard',
      line1: { es: 'Haz una sesión más controlada', eu: 'Egin saio kontrolatuago bat' },
      line2: { es: 'No se trata de correr más, sino de sostener mejor lo que ya sabes.', eu: 'Ez da azkarrago joatea; dakizuna hobeto eustea baizik.' },
      cta: { es: 'Volver con calma', eu: 'Lasai itzuli' },
    },
    {
      register: 'firm',
      line1: { es: 'Asegura el nivel antes del examen', eu: 'Ziurtatu maila azterketaren aurretik' },
      line2: { es: 'Un bloque bien llevado aquí vale más que apretar sin control.', eu: 'Hemen ondo egindako bloke batek gehiago balio du kontrolik gabe estutzeak baino.' },
      cta: { es: 'Afianzar esto', eu: 'Hau sendotu' },
    },
  ],
  statsSummary: [
    {
      register: 'standard',
      line1: { es: 'Tu rendimiento cambia demasiado cuando sube la exigencia.', eu: 'Zure errendimendua gehiegi aldatzen da exijentzia igotzen denean.' },
      line2: { es: 'La prioridad no es correr más, sino aguantar mejor.', eu: 'Lehentasuna ez da gehiago estutzea, hobeto eustea baizik.' },
    },
    {
      register: 'firm',
      line1: { es: 'Sabes más de lo que luego consigues sacar en presión.', eu: 'Badakizu, baina presiopean ez duzu dena ateratzen.' },
      line2: { es: 'Hay margen claro si estabilizas esa parte.', eu: 'Tarte handia dago atal hori egonkortzen baduzu.' },
    },
  ],
  reviewIntro: [
    {
      register: 'standard',
      line1: { es: 'No vayas aún al examen largo.', eu: 'Ez joan oraindik simulakro luzera.' },
      line2: { es: 'Primero afianza respuestas limpias y ritmo estable.', eu: 'Lehenengo sendotu erantzun garbiak eta erritmo egonkorra.' },
      cta: { es: 'Trabajar con calma', eu: 'Lasai landu' },
    },
    {
      register: 'firm',
      line1: { es: 'Aquí conviene bajar ruido.', eu: 'Hemen zarata kentzea komeni da.' },
      line2: { es: 'Repite en formato corto hasta que la respuesta salga más firme.', eu: 'Errepikatu formatu laburrean erantzuna sendoago atera arte.' },
      cta: { es: 'Ir a corto', eu: 'Laburrera joan' },
    },
  ],
  sessionEnd: [
    {
      register: 'standard',
      line1: { es: 'La sesión deja una buena pista: sabes hacerlo mejor de lo que hoy ha salido.', eu: 'Saioak arrasto ona utzi du: gaur atera dena baino hobeto egin dezakezu.' },
      line2: { es: 'Conviene repetir en formato controlado antes de volver a apretar.', eu: 'Komeni da formatu kontrolatuan errepikatzea berriz estutu aurretik.' },
      cta: { es: 'Repetir con control', eu: 'Kontrolarekin errepikatu' },
    },
    {
      register: 'firm',
      line1: { es: 'Sabértelo, te lo sabes. Sostenerlo, todavía no del todo.', eu: 'Jakitea, badakizu. Eustea, oraindik ez guztiz.' },
      line2: { es: 'La siguiente jugada buena es repetir con más control y menos prisa.', eu: 'Hurrengo mugimendu ona kontrol handiagoarekin eta presa gutxiagorekin errepikatzea da.' },
      cta: { es: 'Sostener el nivel', eu: 'Mailari eutsi' },
    },
  ],
},
  recovery_needed: {
    homeHero: [
      {
        eyebrow: { es: 'Sugerencia de hoy', eu: 'Gaurko proposamena' },
        line1: { es: 'Hoy te conviene bajar un punto y recuperar base.', eu: 'Gaur puntu bat jaitsi eta oinarria berreskuratzea komeni zaizu.' },
        line2: { es: 'No es retroceder: es volver a salir con más control.', eu: 'Ez da atzera egitea: kontrol handiagoarekin berriz ateratzea da.' },
        cta: { es: 'Recuperar base', eu: 'Oinarria berreskuratu' },
      },
    ],
    homeCard: [
      {
        line1: { es: 'Recupera sensaciones', eu: 'Berreskuratu sentsazioak' },
        line2: { es: 'Una sesión corta y limpia hoy te deja mejor que forzar volumen.', eu: 'Gaur saio labur eta garbi batek hobeto uzten zaitu bolumena behartzea baino.' },
        cta: { es: 'Ir a corto', eu: 'Laburrera joan' },
      },
    ],
    statsSummary: [
      {
        line1: { es: 'Ahora te rinde más recuperar base que apretar.', eu: 'Une honetan gehiago ematen dizu oinarria berreskuratzeak estutzeak baino.' },
        line2: { es: 'Cuando vuelves a respuestas limpias, el nivel se estabiliza rápido.', eu: 'Erantzun garbietara itzultzen zarenean, maila azkar egonkortzen da.' },
      },
    ],
    reviewIntro: [
      {
        line1: { es: 'Empieza por un bloque sencillo y muy claro.', eu: 'Hasi bloke erraz eta oso argi batekin.' },
        line2: { es: 'Hoy interesa recuperar control, no medirte al límite.', eu: 'Gaur kontrola berreskuratzea interesatzen da, ez muturrera neurtzea.' },
        cta: { es: 'Empezar suave', eu: 'Leun hasi' },
      },
    ],
    sessionEnd: [
      {
        line1: { es: 'Buena sesión para volver a sostenerte.', eu: 'Saio ona berriz eusteko.' },
        line2: { es: 'Si repites pronto, recuperas ritmo sin forzar.', eu: 'Laster errepikatzen baduzu, erritmoa berreskuratuko duzu behartu gabe.' },
        cta: { es: 'Dar continuidad', eu: 'Jarraitutasuna eman' },
      },
    ],
  },
  low_momentum: {
    homeHero: [
      {
        eyebrow: { es: 'Sugerencia de hoy', eu: 'Gaurko proposamena' },
        line1: { es: 'Te falta un poco de empuje estos días.', eu: 'Bultzada pixka bat falta zaizu egun hauetan.' },
        line2: { es: 'Una sesión clara te devuelve el paso.', eu: 'Saio argi batek berriz martxan jartzen zaitu.' },
        cta: { es: 'Volver a arrancar', eu: 'Berriz abiatu' },
      },
      {
        eyebrow: { es: 'Ahora mismo', eu: 'Une honetan' },
        line1: { es: 'Te conviene volver a coger tracción.', eu: 'Ongi datorkizu berriz indarra hartzea.' },
        line2: { es: 'No es cuestión de volumen: es cuestión de no soltarte.', eu: 'Ez da bolumen kontua; ez askatzearena baizik.' },
        cta: { es: 'Coger ritmo', eu: 'Erritmoa hartu' },
      },
    ],
    homeCard: [
      {
        line1: { es: 'Haz una sesión que te deje con ganas de seguir', eu: 'Egin jarraitzeko gogoz uzten zaituen saio bat' },
        line2: { es: 'Lo importante es volver a moverte con regularidad.', eu: 'Garrantzitsuena berriz erregulartasunez mugitzea da.' },
        cta: { es: 'Entrar ahora', eu: 'Orain sartu' },
      },
      {
        line1: { es: 'Recupera el paso', eu: 'Berreskuratu pausoa' },
        line2: { es: 'Una sesión bien llevada hoy evita que se enfríe la semana.', eu: 'Gaur ondo egindako saio batek astea hoztea saihesten du.' },
        cta: { es: 'Hacer una buena', eu: 'Saio on bat egin' },
      },
    ],
    statsSummary: [
      {
        line1: { es: 'No vas mal, pero te falta continuidad reciente.', eu: 'Ez zoaz gaizki, baina azken egunetan jarraitutasuna falta da.' },
        line2: { es: 'Una o dos sesiones más cambian mucho esta foto.', eu: 'Beste saio batek edo bik asko aldatzen dute argazki hau.' },
      },
      {
        line1: { es: 'Tu semana pide volver a ponerse en marcha.', eu: 'Zure asteak berriz martxan jartzea eskatzen du.' },
        line2: { es: 'No hace falta apretar fuerte: hace falta aparecer.', eu: 'Ez da gogor estutu behar: agertu egin behar da.' },
      },
    ],
    reviewIntro: [
      {
        line1: { es: 'Empieza por un bloque sencillo.', eu: 'Hasi bloke erraz batekin.' },
        line2: { es: 'Te interesa más engancharte que medirte ahora mismo.', eu: 'Une honetan gehiago interesatzen zaizu berriz lotzea neurtzea baino.' },
        cta: { es: 'Empezar ya', eu: 'Orain hasi' },
      },
      {
        line1: { es: 'Hazlo fácil de retomar.', eu: 'Egin berriz hartzeko erraza izan dadin.' },
        line2: { es: 'Cuando vuelves a entrar, luego ya puedes apretar más.', eu: 'Berriz barrura sartzen zarenean, gero estuago joan zaitezke.' },
        cta: { es: 'Entrar con calma', eu: 'Lasai sartu' },
      },
    ],
    sessionEnd: [
      {
        line1: { es: 'Ya has vuelto a moverte.', eu: 'Berriz mugitzen hasi zara.' },
        line2: { es: 'Lo importante ahora es no dejarlo caer otra vez.', eu: 'Orain garrantzitsuena berriz ez uztea da.' },
        cta: { es: 'Mantener el paso', eu: 'Pausoari eutsi' },
      },
      {
        line1: { es: 'Buena manera de reactivar la semana.', eu: 'Astea berriro pizteko modu ona.' },
        line2: { es: 'Si repites pronto, recuperas inercia.', eu: 'Laster errepikatzen baduzu, inertzia berreskuratuko duzu.' },
        cta: { es: 'Dar continuidad', eu: 'Jarraitutasuna eman' },
      },
    ],
  },
  consistency_risk: {
  homeHero: [
    {
      register: 'standard',
      eyebrow: { es: 'Sugerencia de hoy', eu: 'Gaurko proposamena' },
      line1: { es: 'No te conviene estudiar a tirones.', eu: 'Ez zaizu komeni kolpeka ikastea.' },
      line2: { es: 'Hoy toca una sesión que deje continuidad de verdad.', eu: 'Gaur benetako jarraitutasuna uzten duen saioa tokatzen da.' },
      cta: { es: 'Dar continuidad', eu: 'Jarraitutasuna eman' },
    },
    {
      register: 'firm',
      eyebrow: { es: 'Punto a cuidar', eu: 'Zaindu beharrekoa' },
      line1: { es: 'La regularidad se te puede ir si aflojas otro poco.', eu: 'Erregulartasuna joan egin daiteke pixka bat gehiago askatzen baduzu.' },
      line2: { es: 'Mejor una sesión buena hoy que dos a medias luego.', eu: 'Hobe gaur saio on bat, gero erdizka bi baino.' },
      cta: { es: 'Asegurar la semana', eu: 'Astea ziurtatu' },
    },
  ],
  homeCard: [
    {
      register: 'standard',
      line1: { es: 'Haz una sesión que te deje seguido', eu: 'Egin jarraian uzten zaituen saio bat' },
      line2: { es: 'Lo que te hace crecer aquí es repetir con orden.', eu: 'Hemen hazten zaituena ordenaz errepikatzea da.' },
      cta: { es: 'Mantenerme hoy', eu: 'Gaur eutsi' },
    },
    {
      register: 'firm',
      line1: { es: 'Ata la semana', eu: 'Lotu astea' },
      line2: { es: 'No busques heroicidades: busca no romper la cadena.', eu: 'Ez bilatu heroitasunik: bilatu katea ez etetea.' },
      cta: { es: 'Seguir la cadena', eu: 'Katearekin jarraitu' },
    },
  ],
  statsSummary: [
    {
      register: 'standard',
      line1: { es: 'Tu punto sensible ahora no es el nivel: es la constancia.', eu: 'Zure puntu sentikorra orain ez da maila: konstantzia baizik.' },
      line2: { es: 'Cuando apareces varios días seguidos, respondes mucho mejor.', eu: 'Hainbat egun jarraian agertzen zarenean, askoz hobeto erantzuten duzu.' },
    },
    {
      register: 'firm',
      line1: { es: 'Te hace más falta continuidad que variedad.', eu: 'Barietatea baino gehiago jarraitutasuna behar duzu.' },
      line2: { es: 'La mejora aquí viene de repetir sin grandes cortes.', eu: 'Hobekuntza eten handirik gabe errepikatzetik dator hemen.' },
    },
  ],
  reviewIntro: [
    {
      register: 'standard',
      line1: { es: 'Haz algo que puedas volver a hacer mañana.', eu: 'Egin bihar berriz egin ahal izango duzun zerbait.' },
      line2: { es: 'Eso vale más que una sesión grande y aislada.', eu: 'Horrek gehiago balio du saio handi eta isolatu batek baino.' },
      cta: { es: 'Dejarlo encarrilado', eu: 'Bideratuta utzi' },
    },
    {
      register: 'firm',
      line1: { es: 'Aquí suma mucho lo repetible.', eu: 'Hemen errepika daitekeenak asko batzen du.' },
      line2: { es: 'Piensa en sostenerte, no en agotarte.', eu: 'Pentsatu eustean, ez nekatzean.' },
      cta: { es: 'Hacerlo sostenible', eu: 'Eramangarri egin' },
    },
  ],
  sessionEnd: [
    {
      register: 'standard',
      line1: { es: 'Buena sesión para no perder el paso.', eu: 'Pausoa ez galtzeko saio ona.' },
      line2: { es: 'Si vuelves mañana o pasado, se nota enseguida.', eu: 'Bihar edo etzi itzultzen bazara, berehala nabaritzen da.' },
      cta: { es: 'Repetir pronto', eu: 'Laster errepikatu' },
    },
    {
      register: 'firm',
      line1: { es: 'Esto te deja bien colocado.', eu: 'Honek ondo kokatuta uzten zaitu.' },
      line2: { es: 'Ahora lo importante es darle continuidad, no dejarlo suelto.', eu: 'Orain garrantzitsuena jarraipena ematea da, ez solte uztea.' },
      cta: { es: 'Seguir la cadena', eu: 'Katearekin jarraitu' },
    },
  ],
},
  memory_instability: {
    homeHero: [
      {
        eyebrow: { es: 'Sugerencia de hoy', eu: 'Gaurko proposamena' },
        line1: { es: 'Lo visto todavía no está del todo firme.', eu: 'Ikusitakoa oraindik ez dago guztiz sendo.' },
        line2: { es: 'Hoy te renta asentarlo antes de seguir abriendo.', eu: 'Gaur gehiago ematen dizu hori finkatzeak beste gauza berriak irekitzeak baino.' },
        cta: { es: 'Asentar lo visto', eu: 'Ikusitakoa finkatu' },
      },
      {
        eyebrow: { es: 'Punto de estudio', eu: 'Ikasteko puntua' },
        line1: { es: 'Hay cosas que sabes, pero aún no aguantan bien.', eu: 'Badakizun gauzak daude, baina oraindik ez dute ondo eusten.' },
        line2: { es: 'Un repaso fino aquí te las deja mucho más seguras.', eu: 'Hemen errepaso fin batek askoz seguruago uzten dizkizu.' },
        cta: { es: 'Reforzar ahora', eu: 'Orain indartu' },
      },
    ],
    homeCard: [
      {
        line1: { es: 'Refuerza antes de ampliar', eu: 'Indartu zabaldu aurretik' },
        line2: { es: 'Si sujetas mejor lo visto, luego todo entra mejor.', eu: 'Ikusitakoa hobeto lotzen baduzu, gero dena hobeto sartzen da.' },
        cta: { es: 'Reforzar base', eu: 'Oinarria indartu' },
      },
      {
        line1: { es: 'Vuelve a lo que ya rozas', eu: 'Itzuli ia menperatzen duzunera' },
        line2: { es: 'Ahí suele estar la mejora más rentable del día.', eu: 'Hor egoten da askotan eguneko hobekuntzarik errentagarriena.' },
        cta: { es: 'Consolidar esto', eu: 'Hau sendotu' },
      },
    ],
    statsSummary: [
      {
        line1: { es: 'No estás para empezar de cero: estás para fijar mejor lo que ya has tocado.', eu: 'Ez zaude hutsetik hasteko: ukitu duzuna hobeto finkatzeko baizik.' },
        line2: { es: 'Ese ajuste hace que el estudio deje más poso.', eu: 'Doikuntza horrek ikasketak arrasto handiagoa uztea egiten du.' },
      },
      {
        line1: { es: 'Tu punto débil ahora no es entenderlo: es retenerlo bien.', eu: 'Zure puntu ahula orain ez da ulertzea: ondo gogoratzea baizik.' },
        line2: { es: 'Ahí es donde más conviene insistir.', eu: 'Hor da gehien insistitzea komeni den lekua.' },
      },
    ],
    reviewIntro: [
      {
        line1: { es: 'Vuelve a lo que casi sale.', eu: 'Itzuli ia ateratzen denera.' },
        line2: { es: 'Con un repaso bueno, eso deja de bailar.', eu: 'Errepaso on batekin, hori ez da hainbeste mugitzen.' },
        cta: { es: 'Fijarlo bien', eu: 'Ondo finkatu' },
      },
      {
        line1: { es: 'No te hace falta más materia: te hace falta más asiento.', eu: 'Ez duzu materia gehiago behar: finkapen handiagoa baizik.' },
        line2: { es: 'Busca que la respuesta te salga más firme.', eu: 'Bilatu erantzuna sendoago ateratzea.' },
        cta: { es: 'Repetir con sentido', eu: 'Zentzuz errepikatu' },
      },
    ],
    sessionEnd: [
      {
        line1: { es: 'La sesión te dice bien por dónde reforzar.', eu: 'Saioak ondo esaten dizu nondik indartu.' },
        line2: { es: 'Si vuelves a ello pronto, se queda mucho mejor.', eu: 'Laster itzultzen bazara, askoz hobeto geratzen da.' },
        cta: { es: 'Volver a reforzar', eu: 'Berriz indartzera itzuli' },
      },
      {
        line1: { es: 'No estás lejos: te falta fijarlo.', eu: 'Ez zaude urrun: finkatzea falta zaizu.' },
        line2: { es: 'La siguiente sesión buena es de refuerzo, no de dispersión.', eu: 'Hurrengo saio ona indartzekoa da, ez sakabanatzekoa.' },
        cta: { es: 'Hacer un refuerzo', eu: 'Indartze saio bat egin' },
      },
    ],
  },
  stable_accuracy: {
    homeHero: [
      {
        eyebrow: { es: 'Sugerencia de hoy', eu: 'Gaurko proposamena' },
        line1: { es: 'Lo estás asentando bien.', eu: 'Ondo ari zara finkatzen.' },
        line2: { es: 'Hoy te conviene seguir sin romper el ritmo.', eu: 'Gaur komeni zaizu erritmoa hautsi gabe jarraitzea.' },
        cta: { es: 'Seguir por aquí', eu: 'Hemendik jarraitu' },
      },
      {
        eyebrow: { es: 'Buen momento', eu: 'Une ona' },
        line1: { es: 'Tu base está respondiendo con bastante firmeza.', eu: 'Zure oinarria nahiko sendo erantzuten ari da.' },
        line2: { es: 'La jugada buena es darle continuidad.', eu: 'Mugimendu ona jarraipena ematea da.' },
        cta: { es: 'Mantener nivel', eu: 'Mailari eutsi' },
      },
    ],
    homeCard: [
      {
        line1: { es: 'Mantén la línea', eu: 'Mantendu bidea' },
        line2: { es: 'No hace falta cambiar mucho cuando algo ya está funcionando.', eu: 'Zerbait ondo dabilenean ez da asko aldatu behar.' },
        cta: { es: 'Seguir entrenando', eu: 'Entrenatzen jarraitu' },
      },
      {
        line1: { es: 'Aprovecha que estás fino', eu: 'Aprobetxatu fin zaudela' },
        line2: { es: 'Una sesión más aquí te deja todavía más asentado.', eu: 'Beste saio batek are finkoago uzten zaitu.' },
        cta: { es: 'Continuar así', eu: 'Horrela jarraitu' },
      },
    ],
    statsSummary: [
      {
        line1: { es: 'Tu trabajo reciente está dejando base de verdad.', eu: 'Azken lana benetako oinarria uzten ari da.' },
        line2: { es: 'No se trata de tocarlo todo: se trata de seguir bien.', eu: 'Ez da dena ukitzea: ondo jarraitzea baizik.' },
      },
      {
        line1: { es: 'Ahora mismo vas con bastante solidez.', eu: 'Une honetan nahiko sendo zoaz.' },
        line2: { es: 'La prioridad es sostener esta línea sin aflojar.', eu: 'Lehentasuna lerro honi eustea da, askatu gabe.' },
      },
    ],
    reviewIntro: [
      {
        line1: { es: 'No hace falta desmontarlo todo.', eu: 'Ez da dena desmuntatu behar.' },
        line2: { es: 'Repasa lo justo y sigue construyendo desde ahí.', eu: 'Errepasatu behar dena eta hortik eraikitzen jarraitu.' },
        cta: { es: 'Seguir bien', eu: 'Ondo jarraitu' },
      },
      {
        line1: { es: 'Tu trabajo ya tiene buena base.', eu: 'Zure lanak oinarri ona dauka jada.' },
        line2: { es: 'Haz un repaso limpio y vuelve a avanzar.', eu: 'Egin errepaso garbia eta aurrera itzuli.' },
        cta: { es: 'Repasar y seguir', eu: 'Errepasatu eta jarraitu' },
      },
    ],
    sessionEnd: [
      {
        line1: { es: 'Buena sesión.', eu: 'Saio ona.' },
        line2: { es: 'Estás dejando una base bastante seria; toca seguir así.', eu: 'Oinarri sendoa uzten ari zara; horrela jarraitzea tokatzen da.' },
        cta: { es: 'Mantener la línea', eu: 'Lerroari eutsi' },
      },
      {
        line1: { es: 'Vas asentando bien el trabajo.', eu: 'Lana ondo finkatzen ari zara.' },
        line2: { es: 'La mejor continuación es otra sesión limpia, sin inventar demasiado.', eu: 'Jarraipenik onena beste saio garbi bat da, gehiegi asmatu gabe.' },
        cta: { es: 'Hacer otra parecida', eu: 'Antzeko beste bat egin' },
      },
    ],
  },
  momentum_up: {
    homeHero: [
      {
        eyebrow: { es: 'Sugerencia de hoy', eu: 'Gaurko proposamena' },
        line1: { es: 'Vas en buena línea.', eu: 'Bide onean zoaz.' },
        line2: { es: 'Hoy puedes pedirte un poco más sin perder control.', eu: 'Gaur pixka bat gehiago eska diezaiokezu zeure buruari kontrola galdu gabe.' },
        cta: { es: 'Subir un punto', eu: 'Puntu bat igo' },
      },
      {
        eyebrow: { es: 'Buen momento', eu: 'Une ona' },
        line1: { es: 'Ahora sí merece la pena apretar un poco.', eu: 'Orain bai merezi duela pixka bat estutzea.' },
        line2: { es: 'Tu base aguanta bien una sesión más exigente.', eu: 'Zure oinarriak ondo eusten dio saio zorrotzago bati.' },
        cta: { es: 'Subir nivel', eu: 'Maila igo' },
      },
    ],
    homeCard: [
      {
        line1: { es: 'Aprovecha el momento', eu: 'Aprobetxatu unea' },
        line2: { es: 'Si hoy te exiges un poco más, lo puedes sostener bien.', eu: 'Gaur pixka bat gehiago eskatzen badiozu zeure buruari, ondo eutsi diezaiokezu.' },
        cta: { es: 'Ir un paso más', eu: 'Pauso bat gehiago eman' },
      },
      {
        line1: { es: 'Puedes subir sin romperte', eu: 'Igo zaitezke hautsi gabe' },
        line2: { es: 'No es el día para guardarte del todo.', eu: 'Ez da gaur guztiz gordetzeko eguna.' },
        cta: { es: 'Exigirme un poco más', eu: 'Pixka bat gehiago exijitu' },
      },
    ],
    statsSummary: [
      {
        line1: { es: 'Tu trabajo reciente te permite subir un poco la exigencia.', eu: 'Azken lanak exijentzia pixka bat igotzea ahalbidetzen dizu.' },
        line2: { es: 'Hay base para empujar sin hacerlo a lo loco.', eu: 'Badago oinarria bultzatzeko, bururik gabe egin gabe.' },
      },
      {
        line1: { es: 'Estás en un momento aprovechable.', eu: 'Aprobetxatzeko moduko unean zaude.' },
        line2: { es: 'La clave es subir un punto, no pasarte tres.', eu: 'Gakoa puntu bat igotzea da, ez hiru pasatzea.' },
      },
    ],
    reviewIntro: [
      {
        line1: { es: 'Aprovecha que vas fino.', eu: 'Aprobetxatu fin zoazela.' },
        line2: { es: 'Haz una sesión exigente, pero con cabeza.', eu: 'Egin saio zorrotz bat, baina zentzuz.' },
        cta: { es: 'Apretar bien', eu: 'Ondo estutu' },
      },
      {
        line1: { es: 'Este es buen momento para subir el listón.', eu: 'Une ona da maila pixka bat igotzeko.' },
        line2: { es: 'No hace falta locuras: solo un paso más.', eu: 'Ez da erokeriarik behar: pauso bat gehiago bakarrik.' },
        cta: { es: 'Subir el listón', eu: 'Maila igo' },
      },
    ],
    sessionEnd: [
      {
        line1: { es: 'Sesión muy aprovechable.', eu: 'Oso aprobetxagarria izan da saioa.' },
        line2: { es: 'Puedes permitirte seguir subiendo un poco más.', eu: 'Pixka bat gehiago igotzen jarrai dezakezu.' },
        cta: { es: 'Seguir empujando', eu: 'Bultzatzen jarraitu' },
      },
      {
        line1: { es: 'Hoy había nivel y se ha notado.', eu: 'Gaur maila zegoen, eta nabaritu da.' },
        line2: { es: 'La siguiente buena jugada es volver a exigirte un punto más.', eu: 'Hurrengo mugimendu ona berriz puntu bat gehiago eskatzea da.' },
        cta: { es: 'Dar otro paso', eu: 'Beste pauso bat eman' },
      },
    ],
  },
  gray_zone: {
    homeHero: [
      {
        eyebrow: { es: 'Sugerencia de hoy', eu: 'Gaurko proposamena' },
        line1: { es: 'Hoy conviene hacerlo fácil de decidir.', eu: 'Gaur erraza izatea komeni da erabakitzeko.' },
        line2: { es: 'Una sesión clara y corta es mejor que darle demasiadas vueltas.', eu: 'Saio argi eta labur bat hobe da buelta gehiegi ematea baino.' },
        cta: { es: 'Ir a lo claro', eu: 'Argira joan' },
      },
      {
        eyebrow: { es: 'Ahora mismo', eu: 'Une honetan' },
        line1: { es: 'No hace falta hilar fino para seguir avanzando.', eu: 'Ez da oso fin ibili behar aurrera jarraitzeko.' },
        line2: { es: 'Empieza por algo directo y deja que el ritmo vuelva solo.', eu: 'Hasi zerbait zuzenarekin eta utzi erritmoa berez etortzen.' },
        cta: { es: 'Hacer una sencilla', eu: 'Erraz bat egin' },
      },
    ],
    homeCard: [
      {
        line1: { es: 'Ve a una sesión simple', eu: 'Joan saio sinple batera' },
        line2: { es: 'Ahora te ayuda más decidir poco y hacer bien.', eu: 'Orain gehiago laguntzen dizu gutxi erabaki eta ondo egiteak.' },
        cta: { es: 'Empezar sin dudar', eu: 'Zalantzarik gabe hasi' },
      },
      {
        line1: { es: 'Haz algo claro y ejecutable', eu: 'Egin argi eta egin daitekeen zerbait' },
        line2: { es: 'Cuando el día viene raro, mejor una sesión limpia que una ambiciosa.', eu: 'Eguna arraro datorrenean, hobe saio garbia anbiziotsua baino.' },
        cta: { es: 'Ir a lo sencillo', eu: 'Errazera joan' },
      },
    ],
    statsSummary: [
      {
        line1: { es: 'Todavía falta un poco para leer este momento con nitidez.', eu: 'Oraindik pixka bat falta da une hau argi irakurtzeko.' },
        line2: { es: 'La mejor decisión ahora es una sesión clara y fácil de cumplir.', eu: 'Erabakirik onena orain saio argi eta betetzeko erraza da.' },
      },
      {
        line1: { es: 'No estás en un día para complicarlo.', eu: 'Ez zaude gaur gauzak konplikatzeko egunean.' },
        line2: { es: 'Conviene hacer una buena sesión sencilla y seguir desde ahí.', eu: 'Komeni da saio sinple on bat egitea eta hortik jarraitzea.' },
      },
    ],
    reviewIntro: [
      {
        line1: { es: 'Ve a lo más claro.', eu: 'Joan argienera.' },
        line2: { es: 'Hoy suma más terminar algo bien que diseñar mucho.', eu: 'Gaur gehiago batzen du zerbait ondo amaitzeak asko diseinatzeak baino.' },
        cta: { es: 'Hacerlo simple', eu: 'Sinple egin' },
      },
      {
        line1: { es: 'Haz una sesión que no te cueste empezar.', eu: 'Egin hasteko kostatuko ez zaizun saio bat.' },
        line2: { es: 'Eso te deja mejor que esperar al plan perfecto.', eu: 'Horrek plan perfektuaren zain egoteak baino hobeto uzten zaitu.' },
        cta: { es: 'Empezar ya', eu: 'Orain hasi' },
      },
    ],
    sessionEnd: [
      {
        line1: { es: 'Sesión hecha, que hoy era lo importante.', eu: 'Saioa eginda, hori baitzen gaur garrantzitsuena.' },
        line2: { es: 'A veces lo mejor es no complicarlo más y seguir así.', eu: 'Batzuetan onena gehiago ez konplikatzea eta horrela jarraitzea da.' },
        cta: { es: 'Seguir simple', eu: 'Sinple jarraitu' },
      },
      {
        line1: { es: 'Buen cierre para un día de duda.', eu: 'Itxiera ona zalantzazko egun baterako.' },
        line2: { es: 'Quédate con esto: has hecho lo que tocaba.', eu: 'Geratu honekin: tokatzen zena egin duzu.' },
        cta: { es: 'Volver mañana', eu: 'Bihar itzuli' },
      },
    ],
  },
};

export const resolveCoachSurfaceState = (
  plan: CoachPlanV2 | null,
  bundle: DashboardBundle | null,
): SurfaceCopyState => {
  if (!plan || !bundle) return 'gray_zone';

  const learningV2 = bundle.practiceState.learningDashboardV2;
  const pressureV2 = bundle.practiceState.pressureInsightsV2;
  const backlogOverdue = learningV2?.backlogOverdueCount ?? bundle.practiceState.learningDashboard?.overdueCount ?? 0;
  const pressureGap = pressureV2?.pressureGapRaw ?? bundle.practiceState.pressureInsights?.pressureGap ?? null;
  const fragileCount = learningV2?.fragileCount ?? 0;
  const recentAccuracy = computeRecentAccuracy(bundle.practiceState.recentSessions);
  const daysOff = daysSinceLastSession(bundle.practiceState.recentSessions);
  const weeklyQuestions = computeWeeklyQuestions(bundle.practiceState.recentSessions);

  if (plan.decisionMeta?.grayZoneTriggered) return 'gray_zone';
  if (backlogOverdue >= 10) return 'high_backlog';
  if (plan.primaryAction === 'anti_trap') return 'repeated_errors';
  if (plan.primaryAction === 'recovery' && (daysOff ?? 0) >= 3) return 'recovery_needed';
  if (plan.primaryAction === 'recovery') return 'low_momentum';
  if ((pressureGap ?? 0) >= 0.12 || plan.primaryAction === 'simulacro') return 'pressure_instability';
  if (plan.primaryAction === 'review' && fragileCount >= 8) return 'memory_instability';
  if ((daysOff ?? 0) >= 2 && weeklyQuestions < 40) return 'consistency_risk';
  if (plan.primaryAction === 'push') return 'momentum_up';
  if (recentAccuracy != null && recentAccuracy >= 0.75) return 'stable_accuracy';
  if (fragileCount >= 6 || plan.primaryAction === 'review') return 'memory_instability';
  if (weeklyQuestions > 0 && weeklyQuestions < 25) return 'low_momentum';
  return 'gray_zone';
};

export const getSurfaceCopy = ({
  state,
  surface,
  locale,
  seed,
}: {
  state: SurfaceCopyState;
  surface: CopySurface;
  locale: CopyLocale;
  seed: string;
}) => {
  const set = COPY_LIBRARY[state][surface];
  const register = resolveRegister({ state, surface, seed });

  const filtered = set.filter((variant) => (variant.register ?? 'standard') === register);
  const pool = filtered.length > 0 ? filtered : set;

  const variant = chooseStableVariant(pool, `${surface}:${state}:${register}:${seed}`);

  return {
    register,
    eyebrow: localize(variant?.eyebrow, locale),
    line1: localize(variant?.line1, locale) ?? '',
    line2: localize(variant?.line2, locale),
    cta: localize(variant?.cta, locale),
  };
};

export const buildCoachCopySeed = ({
  curriculum,
  username,
  state,
  extra,
}: {
  curriculum: string;
  username?: string | null;
  state: SurfaceCopyState;
  extra?: string;
}) => [curriculum.trim().toLowerCase(), (username ?? '').trim().toLowerCase(), state, extra ?? 'base'].join(':');

export const buildVisibleStatusLabel = (params: {
  locale: CopyLocale;
  readiness: number | null;
  backlogOverdueCount: number;
  weeklyQuestions: number;
  observedOk: boolean;
  observedAccuracy: number | null;
  pressureGapPct: number | null;
}) => {
  const isBasque = params.locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  if (params.backlogOverdueCount >= 8) return t('Mucho por repasar', 'Asko berrikusteko');
  if (params.backlogOverdueCount >= 3) return t('Repaso pendiente', 'Errepasoa zain');

  if (params.pressureGapPct != null && params.pressureGapPct >= 10) {
    return t('Te cuesta en simulacro', 'Simulakroan kostatzen zaizu');
  }

  if (params.observedOk && params.observedAccuracy != null) {
    if (params.observedAccuracy < 55) return t('Estás fallando más', 'Gehiago huts egiten ari zara');
    if (params.observedAccuracy < 70) return t('Precisión irregular', 'Doitasun irregularra');
  }

  if (params.weeklyQuestions === 0) return t('Te conviene retomar', 'Komeni zaizu berriz hastea');
  if (params.weeklyQuestions < 20) return t('Has bajado ritmo', 'Erritmoa jaitsi zaizu');
  if (params.weeklyQuestions >= 60) return t('Buen ritmo', 'Erritmo ona');

  if (params.readiness != null && params.readiness >= 70) return t('Vas con control', 'Kontrolpean zoaz');
  if (params.readiness != null && params.readiness >= 55) return t('Bien encaminado', 'Bide onean');
  if (params.readiness != null && params.readiness >= 40) return t('Base sin cerrar', 'Oinarria itxi gabe');
  return t('Toca afinar', 'Fintzea tokatzen da');
};

export const buildHeaderStatusCopy = ({
  locale,
  readiness,
  hasReliableReading,
  confidence,
  backlogOverdueCount,
  weeklyQuestions,
  observedOk,
  observedAccuracy,
  pressureGapPct,
}: {
  locale: CopyLocale;
  readiness: number | null;
  hasReliableReading: boolean;
  confidence: 'high' | 'medium' | 'low';
  backlogOverdueCount: number;
  weeklyQuestions: number;
  observedOk: boolean;
  observedAccuracy: number | null;
  pressureGapPct: number | null;
}) => {
  const readingLabel = !hasReliableReading
    ? locale === 'eu'
      ? 'Oraindik egokitzen'
      : 'Aun ajustando'
    : confidence === 'high'
      ? locale === 'eu'
        ? 'Irakurketa argia'
        : 'Lectura clara'
      : confidence === 'medium'
        ? locale === 'eu'
          ? 'Irakurketa nahikoa'
          : 'Lectura suficiente'
        : locale === 'eu'
          ? 'Irakurketa motza'
          : 'Lectura corta';

  const readinessLabel =
    readiness == null
      ? locale === 'eu'
        ? '-'
        : '-'
      : buildVisibleStatusLabel({
          locale,
          readiness,
          backlogOverdueCount,
          weeklyQuestions,
          observedOk,
          observedAccuracy,
          pressureGapPct,
        });

  return {
    readingLabel,
    readinessLabel,
  };
};

export const buildWeakAreaCopy = ({
  locale,
  category,
  state,
  seed,
}: {
  locale: CopyLocale;
  category?: string | null;
  state: SurfaceCopyState;
  seed: string;
}) => {
  if (!category) {
    return {
      title: locale === 'eu' ? 'Ez dago puntu ahul nagusirik' : 'No hay un punto flojo dominante',
      description:
        locale === 'eu'
          ? 'Ez dago gaur bereziki esku hartu beharreko bloketik. Jarraitu erritmo onean.'
          : 'Hoy no aparece un bloque que exija entrar de inmediato. Mantén una sesión limpia.',
      cta: locale === 'eu' ? 'Gomendatutako saioa egin' : 'Hacer sesión recomendada',
    };
  }

  const reviewCopy = getSurfaceCopy({
    state:
      state === 'high_backlog' || state === 'memory_instability'
        ? state
        : 'repeated_errors',
    surface: 'reviewIntro',
    locale,
    seed,
  });

  return {
    title:
      locale === 'eu'
        ? `Berriro hartu: ${category}`
        : `Toca volver sobre ${category}`,
    description: reviewCopy.line2 ?? reviewCopy.line1,
    cta: reviewCopy.cta ?? (locale === 'eu' ? 'Hori zuzendu' : 'Corregir esto'),
  };
};

export const buildSessionEndCopy = ({
  locale,
  payload,
  questionsCount,
  mode,
  curriculum,
  username,
}: {
  locale: CopyLocale;
  payload: FinishedTestPayload;
  questionsCount: number;
  mode: PracticeMode;
  curriculum: string;
  username?: string | null;
}) => {
  const total = Math.max(questionsCount, 1);
  const accuracy = payload.score / total;

  let state: SurfaceCopyState = 'gray_zone';
  if (mode === 'review' && accuracy < 0.75) state = 'repeated_errors';
  else if (mode === 'simulacro' && accuracy < 0.6) state = 'pressure_instability';
  else if (accuracy < 0.45) state = 'recovery_needed';
  else if (accuracy < 0.6) state = 'memory_instability';
  else if (accuracy < 0.75) state = 'consistency_risk';
  else if (accuracy < 0.88) state = 'stable_accuracy';
  else state = 'momentum_up';

  const seed = buildCoachCopySeed({
    curriculum,
    username,
    state,
    extra: `${mode}:${payload.score}:${questionsCount}`,
  });

  return {
    state,
    ...getSurfaceCopy({ state, surface: 'sessionEnd', locale, seed }),
  };
};

export const buildReviewSurfaceCopy = ({
  locale,
  failedCount,
  curriculum,
  username,
}: {
  locale: CopyLocale;
  failedCount: number;
  curriculum: string;
  username?: string | null;
}) => {
  const state: SurfaceCopyState = failedCount > 0 ? 'repeated_errors' : 'stable_accuracy';
  const seed = buildCoachCopySeed({
    curriculum,
    username,
    state,
    extra: `review:${failedCount}`,
  });

  return {
    state,
    ...getSurfaceCopy({ state, surface: 'reviewIntro', locale, seed }),
  };
};

export const buildWeeklyDeltaLabel = ({
  locale,
  currentWeekQuestions,
  previousWeekQuestions,
}: {
  locale: CopyLocale;
  currentWeekQuestions: number;
  previousWeekQuestions: number;
}) => {
  if (previousWeekQuestions <= 0) {
    return currentWeekQuestions > 0
      ? locale === 'eu'
        ? 'Astea berriz martxan'
        : 'Semana ya en marcha'
      : locale === 'eu'
        ? 'Oraindik mugimendu gutxi'
        : 'Aun con poco movimiento';
  }

  if (currentWeekQuestions >= previousWeekQuestions * 1.15) {
    return locale === 'eu' ? 'Aurreko astea baino hobeto' : 'Mejor que la semana pasada';
  }
  if (currentWeekQuestions >= previousWeekQuestions * 0.9) {
    return locale === 'eu' ? 'Aurreko astearen parean' : 'En la línea de la semana pasada';
  }
  return locale === 'eu' ? 'Aurreko astea baino motelago' : 'Algo por debajo de la semana pasada';
};
