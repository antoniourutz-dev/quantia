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

const hashSeed = (seed: string) => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
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
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const total = Math.max(input.questionsCount, 1);
  const accuracy = input.payload.score / total;

  // Calculate Avg Time to sense "Impulsive" reading
  const avgTimeMs =
    input.payload.answers.length > 0
      ? input.payload.answers.reduce((acc, curr) => acc + (curr.responseTimeMs ?? 0), 0) /
        input.payload.answers.length
      : 0;
  const avgTimeSec = avgTimeMs / 1000;

  let state: SurfaceCopyState = 'gray_zone';
  let variantCategory:
    | 'mala'
    | 'simulacro_flojo'
    | 'impulse'
    | 'recovery'
    | 'irregular'
    | 'buena'
    | 'excelente' = 'irregular';

  // 1. Matrix State Resolution (Strict Hierarchy)
  if (input.didReturnAfterGap && accuracy >= 0.4) {
    state = 'low_momentum';
    variantCategory = 'recovery';
  } else if (input.mode === 'simulacro' && accuracy < 0.6) {
    state = 'pressure_instability';
    variantCategory = 'simulacro_flojo';
  } else if (accuracy < 0.6 && avgTimeSec > 0 && avgTimeSec < 7.5) {
    state = 'repeated_errors';
    variantCategory = 'impulse';
  } else if (accuracy < 0.5) {
    state = 'recovery_needed';
    variantCategory = 'mala';
  } else if (accuracy < 0.7) {
    state = 'memory_instability';
    variantCategory = 'irregular';
  } else if (accuracy < 0.88) {
    state = 'stable_accuracy';
    variantCategory = 'buena';
  } else {
    state = 'momentum_up';
    variantCategory = 'excelente';
  }

  // 2. Motivating Opositor Copy Matrix (ES / EU)
  const copyMatrix: Record<typeof variantCategory, Array<{ t: string; b: string }>> = {
    mala: [
      {
        t: t('Hoy has sacado a la luz justo lo que más suma mejorar.', 'Gaur hobetzeak gehien ematen duena atera duzu argitara.'),
        b: t('Cada fallo detectado aquí es un punto que no regalas el día del examen. Revísalos con calma y verás el salto.', 'Hemen detektatutako akats bakoitza azterketa egunean galduko ez duzun puntu bat da. Berrikusi lasai eta jauzia ikusiko duzu.'),
      },
      {
        t: t('Test exigente, aprendizaje real.', 'Test zorrotza, benetako ikasketa.'),
        b: t('Los bloques difíciles son los que de verdad suben tu nota. Quédate con los 3 o 4 conceptos clave y vuelve a por ellos.', 'Bloke zailek igotzen dute benetan zure nota. Gorde 3-4 kontzeptu gako eta itzuli haien bila.'),
      },
      {
        t: t('No te desanimes: estás construyendo la base.', 'Ez etsi: oinarria eraikitzen ari zara.'),
        b: t('Nadie domina un temario a la primera. Haber terminado el test ya te da el mapa exacto de dónde reforzar hoy.', 'Inork ez du gai-zerrenda lehenengoan menderatzen. Testa amaitzeak gaur non indartu jakiteko mapa zehatza ematen dizu.'),
      },
      {
        t: t('Buen diagnóstico para subir rápido.', 'Diagnostiko ona azkar igotzeko.'),
        b: t('Ahora sabes exactamente qué preguntas te hacen dudar. Un repaso corto de estos fallos cambiará por completo el próximo resultado.', 'Orain badakizu zehazki zein galderak sortzen dizuten zalantza. Akats hauen errepaso labur batek erabat aldatuko du hurrengo emaitza.'),
      },
      {
        t: t('Fallar entrenando es ganar el día del examen.', 'Entrenatzen huts egitea azterketa egunean irabaztea da.'),
        b: t('Mejor tropezar hoy que frente al tribunal. Subraya las explicaciones clave y conviértelos en aciertos seguros.', 'Hobe da gaur estropezu egitea epaimahaiaren aurrean baino. Azpimarratu azalpen gakoak eta bihurtu asmatze ziur.'),
      },
      {
        t: t('Cada sesión difícil te hace más fuerte.', 'Saio zail bakoitzak indartsuago egiten zaitu.'),
        b: t('Has cumplido enfrentándote al bloque completo. Revisa los errores uno a uno y notarás cómo se asienta la norma.', 'Bloke osoari aurre eginez bete duzu. Berrikusi akatsak banan-banan eta araua nola finkatzen den nabarituko duzu.'),
      },
      {
        t: t('Aquí está tu mayor margen de mejora.', 'Hemen dago zure hobetzeko tarterik handiena.'),
        b: t('Cuando un tema cuesta, repasarlo justo después de fallarlo multiplica la retención. ¡A por esa revisión!', 'Gai bat kostatzen denean, huts egin eta berehala errepasatzeak memoria biderkatzen du. Goazen berrikuspen horretara!'),
      },
    ],
    simulacro_flojo: [
      {
        t: t('Para esto existen los simulacros: entrenar sin miedo.', 'Horretarako daude simulakroak: beldurrik gabe entrenatzeko.'),
        b: t('Sabes más de lo que refleja esta nota. Cada simulacro que completas te da temple y te quita nervios para el día oficial.', 'Nota honek erakusten duena baino gehiago dakizu. Osatzen duzun simulakro bakoitzak lasaitasuna ematen dizu egun ofizialerako.'),
      },
      {
        t: t('Has medido el terreno bajo presión real.', 'Benetako presiopean neurtu duzu zelaia.'),
        b: t('No es un examen definitivo, es tu mejor entrenamiento. Revisa dónde te ha restado el ritmo y verás cómo sube tu nota neta.', 'Ez da azken azterketa, zure entrenamendurik onena da. Ikusi erritmoak non kendu dizun eta zure nota garbia nola igotzen den ikusiko duzu.'),
      },
      {
        t: t('Entrenamiento valiente: así se doma el cronómetro.', 'Entrenamendu ausarta: horrela menperatzen da kronometroa.'),
        b: t('Enfrentarte a un simulacro exige coraje. Analiza tus fallos y las preguntas en blanco para ajustar tu estrategia.', 'Simulakro bati aurre egiteak adorea eskatzen du. Aztertu zure akatsak eta galdera zuriak estrategia doitzeko.'),
      },
      {
        t: t('Un simulacro duro vale por tres sesiones normales.', 'Simulakro gogor batek hiru saio arrunt balio ditu.'),
        b: t('Te enseña exactamente dónde apretar y cuándo conviene dejar en blanco. Ya tienes información de oro para el siguiente.', 'Zehazki non estutu eta noiz komeni den zuri uztea erakusten dizu. Urrezko informazioa duzu hurrengorako.'),
      },
      {
        t: t('Paso necesario hacia tu mejor versión de examen.', 'Azterketako zure bertsiorik onenera iristeko urrats beharrezkoa.'),
        b: t('Los grandes resultados nacen de simulacros exigentes como este. Corrige los puntos críticos y volverás mucho más sólido.', 'Emaitza handiak honelako simulakro zorrotzetatik jaiotzen dira. Zuzendu puntu kritikoak eta askoz sendoago itzuliko zara.'),
      },
      {
        t: t('El reloj hoy ha apretado, pero tú has llegado al final.', 'Erlojuak estutu du gaur, baina amaierara iritsi zara.'),
        b: t('Terminar el simulacro completo entrena tu resistencia mental. Ahora toca convertir estas fisuras en puntos seguros.', 'Simulakro osoa amaitzeak zure erresistentzia mentala entrenatzen du. Orain zirrikitu hauek puntu ziur bihurtzea tokatzen da.'),
      },
      {
        t: t('Hoy ajustas, mañana compites mejor.', 'Gaur doitu, bihar hobeto lehiatu.'),
        b: t('Cada fallo que corriges tras un simulacro se queda grabado mucho mejor. Aprovecha la revisión para afianzar tus temas clave.', 'Simulakro baten ondoren zuzentzen duzun akats bakoitza askoz hobeto geratzen da. Aprobetxatu berrikuspena gai gakoak finkatzeko.'),
      },
    ],
    impulse: [
      {
        t: t('Tienes agilidad de sobra: solo falta frenar dos segundos.', 'Arintasuna sobran duzu: bi segundo gelditzea bakarrik falta da.'),
        b: t('Has ido muy rápido y ahí se han escapado aciertos que sí te sabes. Con una lectura un poco más pausada tu nota va a despegar.', 'Oso azkar joan zara eta hor ihes egin dute badakizkizun asmatzeek. Irakurketa apur bat lasaiagoarekin zure nota gora egingo du.'),
      },
      {
        t: t('Tu velocidad ya es de examen; ahora toca afinar el ojo.', 'Zure abiadura azterketakoa da jada; orain begia fintzea tokatzen da.'),
        b: t('Varias preguntas se han ido por detalles del enunciado. Prueba a subrayar las palabras clave antes de marcar y verás el cambio.', 'Hainbat galdera enuntziatuko xehetasunengatik joan dira. Probatu hitz gakoak azpimarratzen erantzun aurretik eta aldaketa ikusiko duzu.'),
      },
      {
        t: t('Vas con mucha energía, canalízala en precisión.', 'Energia handiz zoaz, bideratu zehaztasunera.'),
        b: t('La parte difícil (tener ritmo) ya la tienes. Regálate tres segundos extra en cada opción y recogerás muchos más puntos.', 'Zailena (erritmoa izatea) badaukazu. Eman hiru segundo gehiago aukera bakoitzari eta puntu askoz gehiago jasoko dituzu.'),
      },
      {
        t: t('¡Ojo a los matices! Tienes el nivel para sacar mucho más.', 'Kontuz ñabardurekin! Askoz gehiago ateratzeko maila duzu.'),
        b: t('Cuando bajas un punto las revoluciones, las trampas del enunciado saltan a la vista. En el próximo test lo vas a notar enseguida.', 'Erritmoa puntu bat jaisten duzunean, enuntziatuko tranpak berehala ikusten dira. Hurrengo testean segituan nabarituko duzu.'),
      },
      {
        t: t('Ritmo alto: un poco más de calma y lo clavas.', 'Erritmo altua: lasaitasun pixka bat gehiago eta bikain.'),
        b: t('No te falta estudio, te ha sobrado prisa en un par de preguntas trampa. Usa el modo Análisis si quieres desgranar mejor cada opción.', 'Ez zaizu ikasketa falta, presa soberan izan duzu tranpa-galdera pare batean. Erabili Analisi modua aukera bakoitza hobeto aztertzeko.'),
      },
      {
        t: t('Controlar el impulso vale puntos de oro.', 'Bulkada kontrolatzeak urrezko puntuak balio ditu.'),
        b: t('En oposiciones, leer el «no», «salvo» o «siempre» marca la diferencia. Ya tienes el reflejo; ahora pulimos la pausa.', 'Oposizioetan, «ez», «salbu» edo «beti» irakurtzeak aldea markatzen du. Erreflexua baduzu; orain pausa landuko dugu.'),
      },
      {
        t: t('Conocimientos tienes: dale un respiro a cada lectura.', 'Ezagutza baduzu: eman arnasa irakurketa bakoitzari.'),
        b: t('Revisa los fallos rápidos de esta sesión y verás cuántas sabías realmente. Esa es la mejor noticia: puedes subir nota hoy mismo.', 'Berrikusi saio honetako akats azkarrak eta ikusiko duzu zenbat zenekizkien benetan. Hori da berririk onena: gaur bertan igo dezakezu nota.'),
      },
    ],
    recovery: [
      {
        t: t('¡Qué bien volver a verte por aquí!', 'Zein ona zu berriro hemen ikustea!'),
        b: t('Retomar el hábito después de una pausa es lo más difícil y ya lo has hecho. Hoy cuenta doble.', 'Etenaldi baten ondoren ohiturari berriro heltzea da zailena eta jada egin duzu. Gaurkoak bikoitza balio du.'),
      },
      {
        t: t('Has vuelto al ritmo. Ese era el objetivo de hoy.', 'Erritmora itzuli zara. Hori zen gaurko helburua.'),
        b: t('Lo importante no era clavar la nota, sino volver a poner la máquina en marcha. A partir de aquí todo va hacia arriba.', 'Garrantzitsuena ez zen nota perfektua ateratzea, makina berriro martxan jartzea baizik. Hemendik aurrera dena gorantz doa.'),
      },
      {
        t: t('El paso más duro ya está dado.', 'Pausorik zailena emanda dago.'),
        b: t('Aparecer hoy mantiene viva tu preparación. Con dos sesiones seguidas recuperarás toda tu velocidad y precisión.', 'Gaur agertzeak zure prestaketa bizirik mantentzen du. Bi saio jarraian eginda abiadura eta zehaztasun osoa berreskuratuko dituzu.'),
      },
      {
        t: t('De vuelta en el camino hacia tu plaza.', 'Zure plazarako bidean berriro.'),
        b: t('En una oposición gana quien vuelve siempre que hace falta. Gran decisión sentarte hoy a practicar.', 'Oposizio batean behar den bakoitzean itzultzen denak irabazten du. Erabaki bikaina gaur praktikatzera esertzea.'),
      },
      {
        t: t('¡Motor encendido de nuevo!', 'Motorra berriro martxan!'),
        b: t('Has roto la inercia con muy buen pie. Guarda esta sensación y mañana será todavía más fácil continuar.', 'Inertzia oso ondo hautsi duzu. Gorde sentsazio hau eta bihar are errazagoa izango da jarraitzea.'),
      },
      {
        t: t('Constancia recuperada: suma y sigue.', 'Jarraitutasuna berreskuratuta: aurrera!'),
        b: t('Un test completado hoy vale mucho más que esperar al día perfecto. Sigue así, paso a paso.', 'Gaur osatutako test batek egun perfektuaren zain egoteak baino askoz gehiago balio du. Jarraitu horrela, pausoz pauso.'),
      },
      {
        t: t('Volver a entrenar ya es una victoria.', 'Berriro entrenatzea garaipena da jada.'),
        b: t('La memoria despierta rápido en cuanto la activas. Repasa los fallos de hoy y notarás el empujón enseguida.', 'Memoria azkar esnatzen da aktibatu bezain laster. Errepasatu gaurko akatsak eta bultzada berehala nabarituko duzu.'),
      },
    ],
    irregular: [
      {
        t: t('Buena base en marcha: estás más cerca de lo que crees.', 'Oinarri ona martxan: uste duzuna baino gertuago zaude.'),
        b: t('Ya dominas una buena parte del bloque. Con un repaso enfocado a los fallos de hoy, este tema sube a zona verde.', 'Blokearen zati handi bat menderatzen duzu jada. Gaurko akatsen errepaso zehatz batekin, gai hau eremu berdera igoko da.'),
      },
      {
        t: t('Progreso sólido: ahora toca pulir detalles.', 'Aurrerapen sendoa: orain xehetasunak leuntzea tokatzen da.'),
        b: t('Has resuelto bien gran parte del test. Revisar los errores concretos ahora es la forma más rápida de consolidar.', 'Testaren zati handi bat ondo ebatzi duzu. Orain akats zehatzak berrikustea da finkatzeko modurik azkarrena.'),
      },
      {
        t: t('Vas sumando puntos cada día.', 'Egunero puntuak batzen ari zara.'),
        b: t('Entre una nota media y una nota de corte solo hay unos pocos matices bien repasados. ¡A por ellos!', 'Batez besteko nota baten eta gutxieneko notaren artean ondo errepasatutako ñabardura gutxi batzuk besterik ez daude. Goazen!'),
      },
      {
        t: t('Paso firme: la curva va hacia arriba.', 'Pauso sendoa: kurba gorantz doa.'),
        b: t('Tienes el temario en la cabeza, solo falta asegurar las preguntas que aún bailan. Un repaso breve y listo.', 'Gai-zerrenda buruan duzu, oraindik zalantzan dauden galderak ziurtatzea bakarrik falta da. Errepaso labur bat eta prest.'),
      },
      {
        t: t('Muy buen entrenamiento para afianzar.', 'Oso entrenamendu ona finkatzeko.'),
        b: t('Cada duda que despejas hoy se convierte en seguridad mañana. Dedica dos minutos a ver las explicaciones de tus fallos.', 'Gaur argitzen duzun zalantza bakoitza biharko segurtasun bihurtzen da. Eman bi minutu zure akatsen azalpenak ikusteari.'),
      },
      {
        t: t('¡Sigue empujando! Estás a un paso de consolidar.', 'Jarraitu bultzatzen! Finkatzetik pauso batera zaude.'),
        b: t('El esfuerzo se nota: ya aciertas la mayoría y tienes identificados justo los flecos que faltan por cerrar.', 'Ahalegina nabaritzen da: gehienak asmatzen dituzu jada eta ixteko falta diren ertzak identifikatuta dituzu.'),
      },
      {
        t: t('Trabajo constante que empieza a dar frutos.', 'Fruituak ematen hasi den lan jarraitua.'),
        b: t('Has defendido bien el test. Repasa los fallos con calma, subraya lo esencial y verás cómo sube el siguiente.', 'Ondo defendatu duzu testa. Berrikusi akatsak lasai, azpimarratu funtsezkoa eta hurrengoa nola igotzen den ikusiko duzu.'),
      },
    ],
    buena: [
      {
        t: t('¡Muy buen test! Se nota el trabajo detrás.', 'Oso test ona! Atzeko lana nabaritzen da.'),
        b: t('Has mantenido una lectura limpia y segura. Sigue con esta constancia: así se construye una plaza.', 'Irakurketa garbi eta seguruari eutsi diozu. Jarraitu jarraitutasun honekin: horrela eraikitzen da plaza bat.'),
      },
      {
        t: t('Gran nivel hoy: control y claridad.', 'Maila handia gaur: kontrola eta argitasuna.'),
        b: t('Resultados así confirman que tu método funciona. Repasa los pocos fallos y dejarás el bloque prácticamente perfecto.', 'Horrelako emaitzek zure metodoak funtzionatzen duela berresten dute. Errepasatu akats gutxiak eta blokea ia perfektu utziko duzu.'),
      },
      {
        t: t('¡Paso de opositor constante!', 'Oposiziogile jarraituaren pausoa!'),
        b: t('Has defendido el bloque con solvencia. Cada sesión como esta consolida tu memoria a largo plazo.', 'Solvitatez defendatu duzu blokea. Horrelako saio bakoitzak epe luzeko memoria finkatzen du.'),
      },
      {
        t: t('Sesión muy sólida: estás cogiendo ritmo de plaza.', 'Oso saio sendoa: plaza-erritmoa hartzen ari zara.'),
        b: t('Aciertas con criterio y reduces el margen de error. ¡Sigue así, vas por un camino excelente!', 'Irizpidez asmatzen duzu eta akats-tartea murrizten duzu. Jarraitu horrela, bide bikainetik zoaz!'),
      },
      {
        t: t('¡Bravo! Hoy has sumado con mucha calidad.', 'Bikain! Gaur kalitate handiz batu duzu.'),
        b: t('No es solo aprobar: es responder con seguridad. Guarda este impulso para el siguiente bloque.', 'Ez da gainditzea bakarrik: segurtasunez erantzutea da. Gorde bultzada hau hurrengo blokerako.'),
      },
      {
        t: t('Buen dominio del bloque.', 'Blokearen menderatze ona.'),
        b: t('Tus horas de estudio se están traduciendo en aciertos claros. Un vistazo rápido a los fallos y a seguir subiendo.', 'Zure ikasketa-orduak asmatze argietan islatzen ari dira. Begirada azkar bat akatsei eta gora jarraitzera.'),
      },
      {
        t: t('Firmeza y constancia: resultado muy meritorio.', 'Sendotasuna eta jarraitutasuna: oso emaitza ona.'),
        b: t('Estás convirtiendo el temario en respuestas automáticas. Cada test así te acerca un poco más a tu objetivo.', 'Gai-zerrenda erantzun automatiko bihurtzen ari zara. Horrelako test bakoitzak zure helburura gehiago hurbiltzen zaitu.'),
      },
      {
        t: t('¡Excelente ritmo de entrenamiento!', 'Entrenamendu-erritmo bikaina!'),
        b: t('Se nota que el temario empieza a asentarse de verdad. Mantén esta regularidad y llegarás fortísimo al examen.', 'Nabaritzen da gai-zerrenda benetan finkatzen ari dela. Eutsi erregulartasun honi eta oso indartsu iritsiko zara azterketara.'),
      },
    ],
    excelente: [
      {
        t: t('¡Nivel de examen oficial! Brutal sesión.', 'Azterketa ofizialeko maila! Saio izugarria.'),
        b: t('Un resultado así nunca es casualidad: es el reflejo directo de tu constancia y de cómo dominas el temario.', 'Horrelako emaitza bat ez da inoiz kasualitatea: zure jarraitutasunaren eta gai-zerrenda menderatzearen isla zuzena da.'),
      },
      {
        t: t('¡Impecable! Así se gana una plaza.', 'Akatsik gabea! Horrela irabazten da plaza bat.'),
        b: t('Precisión, calma y dominio total del bloque. Disfruta este resultado porque te lo has ganado a pulso.', 'Zehaztasuna, lasaitasuna eta blokearen erabateko kontrola. Gozatu emaitza hau, merezita irabazi duzulako.'),
      },
      {
        t: t('¡Dominio absoluto en esta ronda!', 'Erabateko nagusitasuna txanda honetan!'),
        b: t('Has resuelto con una solvencia envidiable. Mantén este nivel de exigencia y pocos temas se te van a resistir.', 'Solvitate ikaragarriarekin ebatzi duzu. Eutsi exijentzia-maila honi eta gai gutxik egingo dizute aurre.'),
      },
      {
        t: t('¡Espectacular! Estás un peldaño por encima.', 'Ikusgarria! Maila bat gorago zaude.'),
        b: t('Lectura fina, decisiones limpias y resultado sobresaliente. Este es el estándar que te lleva al objetivo.', 'Irakurketa fina, erabaki garbiak eta emaitza bikaina. Hau da helburura eramango zaituen maila.'),
      },
      {
        t: t('¡Clavado! Tu preparación está brillando.', 'Bikain egina! Zure prestaketa distira egiten ari da.'),
        b: t('Cada hora invertida se nota en puntuaciones como esta. Sigue cuidando la constancia y confía en tu trabajo.', 'Inbertitutako ordu bakoitza horrelako puntuazioetan nabaritzen da. Zaindu jarraitutasuna eta izan konfiantza zure lanean.'),
      },
      {
        t: t('¡Sobresaliente! Control total del temario.', 'Bikain! Gai-zerrendaren erabateko kontrola.'),
        b: t('Hoy has competido al máximo nivel. Aprovecha esta inercia positiva para atacar algún tema más exigente.', 'Gaur maila gorenean lehiatu zara. Aprobetxatu inertzia positibo hau gai zorrotzago bati heltzeko.'),
      },
      {
        t: t('¡Magnífico resultado! Vas lanzado.', 'Emaitza paregabea! Abiadura hartuta zoaz.'),
        b: t('No solo te sabes la teoría: sabes aplicarla sin caer en trampas. ¡Enhorabuena por esta sesión!', 'Teoria jakiteaz gain, tranpetan erori gabe aplikatzen dakizu. Zorionak saio honengatik!'),
      },
      {
        t: t('¡De diez! Orgullo de sesión.', 'Hamarrekoa! Harro egoteko saioa.'),
        b: t('Este tipo de resultados demuestra de lo que eres capaz cuando combinas estudio y enfoque. ¡A seguir sumando!', 'Horrelako emaitzek erakusten dute zertarako gai zaren ikasketa eta fokua uztartzean. Jarraitu batzen!'),
      },
    ],
  };

  const pool = copyMatrix[variantCategory];
  // Base seed keeps microReward determinism; copySeed also varies across sessions by timestamp
  const seedString = `${input.curriculum}:${input.payload.score}:${input.questionsCount}:${variantCategory}`;
  const lastAnswerAt = input.payload.answers[input.payload.answers.length - 1]?.answeredAt ?? '';
  const copySeed = `${seedString}:${lastAnswerAt}:${input.mode}`;
  const stableIndex = hashSeed(copySeed) % pool.length;
  const copy = pool[stableIndex];

  // Specific internal generic CTA mapped by tone
  const baseCtas: Record<typeof variantCategory, string> = {
    mala: t('Enfocar fallos', 'Hutsak ikusi'),
    simulacro_flojo: t('Cubrir fisuras', 'Zirrikituak estali'),
    impulse: t('Frenar y revisar', 'Gelditu eta errepasatu'),
    recovery: t('Asegurar bloque', 'Blokea ziurtatu'),
    irregular: t('Rematar mejor', 'Hobeto amaitu'),
    buena: t('Sostener firmeza', 'Sendotasunari eutsi'),
    excelente: t('Seguir sumando', 'Batzen jarraitu'),
  };

  const microReward = pickMicroReward(
    {
      locale: input.locale,
      sessionState: state,
      didReturnAfterGap: input.didReturnAfterGap,
      trainedPressure: input.mode === 'simulacro',
      reducedPending: state === 'stable_accuracy',
    },
    seedString,
  );

  return {
    dominantState: state,
    dominantTitle: copy.t,
    dominantBody: copy.b,
    primaryCta: baseCtas[variantCategory],
    microReward: microReward ? { title: microReward.title, detail: microReward.detail } : null,
  };
};
