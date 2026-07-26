// Helpers to turn an order form into (a) a MiniMax "music" style prompt and
// (b) a chat prompt that asks MiniMax-Text-01 to write personalized lyrics.
// Used by /api/generate-song.

// Style id -> descriptive prompt for the MiniMax music model.
export const STYLE_PROMPTS: Record<string, string> = {
  bachata: 'Bachata dominicana romantica, guitarra requinto, bongo y guira, tempo medio',
  cumbia: 'Cumbia festiva y alegre, acordeon, guiro y percusion, ritmo bailable',
  reggaeton: 'Reggaeton urbano, beat dembow, sintetizadores, energico y pegajoso',
  corridos: 'Corridos tumbados, guitarra acustica, tuba y charcheta, estilo norteno moderno',
  vallenato: 'Vallenato colombiano, acordeon, caja y guacharaca, ritmo de paseo',
  salsa: 'Salsa dura con metales, piano montuno, congas y timbales, muy bailable',
  ranchera: 'Ranchera mexicana con mariachi, trompetas y guitarron, sentida y emotiva',
  bolero: 'Bolero clasico romantico, guitarra espanola, cuerdas suaves, intimo y lento',
  merengue: 'Merengue dominicano, tambora, guira y metales, rapido y festivo',
  balada: 'Balada pop latina emotiva, piano y cuerdas, tierna',
};

// Who sings. The LEAD is always an adult voice (female, male, or both taking
// turns). A kids' choir accompanies, but it has to be LOUD and clearly audible
// on every chorus — asking for a "background" choir makes the model bury it to
// the point you can't hear it at all. So: verses = lead alone, chorus = choir
// pushed to the front of the mix, doubling the melody in unison.
// Kept deliberately short: the music model dilutes long prompts, and a buried
// choir instruction is exactly why the kids came out inaudible.
const KIDS_CHOIR =
  'CORO DE NINOS fuerte y destacado en cada estribillo; estrofas solo voz principal';

const VOICE_HINT: Record<string, string> = {
  female: 'voz principal femenina',
  male: 'voz principal masculina',
  duo: 'duo de voz principal femenina y masculina alternando estrofas, con armonias a dos voces',
  femaleKids: `voz principal femenina, ${KIDS_CHOIR}`,
  maleKids: `voz principal masculina, ${KIDS_CHOIR}`,
  all: `duo de voz femenina y masculina alternando estrofas, ${KIDS_CHOIR}`,
};

const TONE_HINT: Record<string, string> = {
  emotional: 'emotivo y sentido',
  festive: 'festivo y alegre',
  romantic: 'romantico y tierno',
  funny: 'divertido y con humor',
};

const OCCASION_LABEL_ES: Record<string, string> = {
  quinceanera: 'sus quince anos (quinceanera)',
  boda: 'su boda',
  cumpleanos: 'su cumpleanos',
  serenata: 'una serenata',
  diaMadres: 'el Dia de las Madres',
  graduacion: 'su graduacion',
  declaracion: 'una declaracion de amor',
  sanValentin: 'San Valentin',
  bautizo: 'su bautizo',
  otro: 'una ocasion especial',
};

const OCCASION_LABEL_EN: Record<string, string> = {
  quinceanera: 'her quinceanera (15th birthday)',
  boda: 'their wedding',
  cumpleanos: 'their birthday',
  serenata: 'a serenade',
  diaMadres: "Mother's Day",
  graduacion: 'their graduation',
  declaracion: 'a love declaration',
  sanValentin: "Valentine's Day",
  bautizo: 'their baptism',
  otro: 'a special occasion',
};

// Tells the LYRICS writer about the vocal line-up, so a duet gets verses that
// can alternate and a kids' choir gets a simple, singalong chorus to back.
const KIDS_LYRIC_EN =
  "A children's choir sings the CHORUS out loud with the lead. Write that chorus so a group of kids can belt it: very short lines (4-6 words), plain everyday words, strong repetition, and the name chanted in it. No complex phrasing in the chorus.";

const KIDS_LYRIC_ES =
  'Un coro de ninos canta el ESTRIBILLO a viva voz junto a la voz principal. Escribe ese estribillo para que un grupo de ninos pueda cantarlo a pleno pulmon: versos muy cortos (4-6 palabras), palabras sencillas y cotidianas, mucha repeticion, y el nombre coreado. Nada complicado en el estribillo.';

const VOICE_LYRIC_HINT_EN: Record<string, string> = {
  duo: 'Two adult singers (female and male) trade the verses — write verses that can alternate between two voices.',
  femaleKids: KIDS_LYRIC_EN,
  maleKids: KIDS_LYRIC_EN,
  all: `Female and male leads trade the verses. ${KIDS_LYRIC_EN}`,
};

const VOICE_LYRIC_HINT_ES: Record<string, string> = {
  duo: 'Dos voces adultas (femenina y masculina) se alternan las estrofas — escribe estrofas que puedan alternarse entre dos voces.',
  femaleKids: KIDS_LYRIC_ES,
  maleKids: KIDS_LYRIC_ES,
  all: `Voz femenina y masculina se alternan las estrofas. ${KIDS_LYRIC_ES}`,
};

export interface SongBrief {
  recipientName?: string;
  relation?: string;
  occasion?: string;
  style?: string;
  anecdote1?: string;
  anecdote2?: string;
  message?: string;
  tone?: string;
  voiceGender?: string;
}

// Production-grade descriptors appended to every music prompt. These are what
// push MiniMax from "demo" to "radio-ready": explicit studio mixing/mastering
// cues, a lead vocal placed up front, and subtle autotune (which also masks the
// model's vocal artifacts). Kept short — the music model ignores long prompts.
// Short on purpose — see KIDS_CHOIR. Everything here competes for the model's
// attention with the style and voice instructions, which matter more.
const PRODUCTION_HINT =
  'produccion radio-ready, mezcla ancha, masterizado, autotune sutil';

// Build the MiniMax music model prompt (style + voice gender + tone + production).
export function buildStylePrompt(styleId?: string, tone?: string, voiceGender?: string): string {
  const base = STYLE_PROMPTS[styleId || ''] || STYLE_PROMPTS.bachata;
  const voice = VOICE_HINT[voiceGender || 'female'] || VOICE_HINT.female;
  const hint = TONE_HINT[tone || ''] || '';
  return [base, voice, hint ? `tono ${hint}` : '', PRODUCTION_HINT]
    .filter(Boolean)
    .join(', ');
}

// Build the chat messages that ask MiniMax-Text-01 for personalized lyrics.
// The model is instructed to return strict JSON: { "title", "lyrics" }.
// When revisionNotes is provided, it asks the model to rewrite applying that change.
export function buildLyricsMessages(brief: SongBrief, language: string, revisionNotes?: string) {
  const isEn = language === 'en';
  const occ = (isEn ? OCCASION_LABEL_EN : OCCASION_LABEL_ES)[brief.occasion || 'otro'] || (isEn ? 'a special occasion' : 'una ocasion especial');
  const story = [brief.anecdote1, brief.anecdote2].filter(Boolean).join(' ');
  const langName = isEn ? 'English' : 'Spanish';

  const system = isEn
    ? [
        'You are a hit songwriter with Billboard-charting credits in Latin music.',
        'You write lyrics that make people cry on first listen — the standard is a professionally released single, not a greeting card.',
        'Your craft rules:',
        '• SHOW, DON\'T TELL. Never state the emotion ("I love you so much"). Build it from concrete, sensory detail — a specific object, smell, gesture, place, or time of day taken from the story you are given.',
        '• Turn the user\'s real details into images. The listener must feel these two people actually exist.',
        '• Write ONE unforgettable hook: a short, repeatable chorus line containing the person\'s name, singable after a single listen.',
        '• Keep natural prosody — lines of similar syllable count, consistent rhyme, stresses that fall where a singer would breathe.',
        '• Build an emotional arc: intimate opening → a turn or confession → a cathartic final chorus.',
        '• BAN clichés and filler: "you are my everything", "my heart beats for you", "together forever", "shining star", "half of me", empty "oh oh oh" padding.',
      ].join('\n')
    : [
        'Eres un compositor de exitos con creditos en listas Billboard de musica latina.',
        'Escribes letras que hacen llorar en la primera escucha — el estandar es un sencillo publicado profesionalmente, no una tarjeta de felicitacion.',
        'Tus reglas de oficio:',
        '• MUESTRA, NO EXPLIQUES. Nunca declares la emocion ("te quiero mucho"). Construyela con detalles concretos y sensoriales — un objeto, un olor, un gesto, un lugar o una hora del dia sacados de la historia que te dan.',
        '• Convierte los detalles reales del usuario en imagenes. El oyente debe sentir que estas dos personas existen de verdad.',
        '• Escribe UN gancho inolvidable: una linea de estribillo corta y repetible que contenga el nombre de la persona, cantable tras una sola escucha.',
        '• Cuida la prosodia — versos de silabas parecidas, rima consistente, acentos donde el cantante respiraria.',
        '• Construye un arco emocional: apertura intima → un giro o confesion → estribillo final catartico.',
        '• PROHIBIDO el cliche y el relleno: "eres mi todo", "mi corazon late por ti", "juntos para siempre", "estrella que brilla", "mi otra mitad", y los "oh oh oh" de relleno.',
      ].join('\n');

  const user = [
    isEn ? `Write an original song in ${langName} for ${brief.recipientName || 'someone special'}.` : `Escribe una cancion original en ${langName === 'Spanish' ? 'espanol' : langName} para ${brief.recipientName || 'alguien especial'}.`,
    isEn ? `Relationship of the person requesting it: ${brief.relation || 'unspecified'}.` : `Relacion de quien la pide: ${brief.relation || 'sin especificar'}.`,
    isEn ? `Occasion: ${occ}.` : `Ocasion: ${occ}.`,
    isEn ? `Musical style/genre: ${brief.style || 'bachata'}.` : `Estilo/genero musical: ${brief.style || 'bachata'}.`,
    story ? (isEn ? `Personal story / anecdotes to weave in: ${story}` : `Historia / anecdotas personales a incluir: ${story}`) : '',
    brief.message ? (isEn ? `A personal message to convey: ${brief.message}` : `Un mensaje personal a transmitir: ${brief.message}`) : '',
    isEn ? `Emotional tone: ${brief.tone || 'emotional'}.` : `Tono emocional: ${brief.tone || 'emotional'}.`,
    (isEn ? VOICE_LYRIC_HINT_EN : VOICE_LYRIC_HINT_ES)[brief.voiceGender || ''] || '',
    revisionNotes
      ? (isEn
          ? `IMPORTANT — this is a REVISION of a previous song. Apply this change requested by the user and rewrite the lyrics accordingly: ${revisionNotes}`
          : `IMPORTANTE — esta es una REVISIÓN de una canción anterior. Aplica este cambio pedido por el usuario y reescribe la letra en consecuencia: ${revisionNotes}`)
      : '',
    '',
    isEn
      ? [
          'Requirements:',
          '- Length: a COMPLETE song of about 2 minutes.',
          '- Structure, in this exact order, each tagged on its own line: [verse] [chorus] [verse] [chorus] [bridge] [chorus].',
          '- Verses: 4 lines each, 7-10 syllables per line. Chorus: 4 lines, the hook line first and repeated as the last line.',
          '- The chorus must be IDENTICAL each time it appears (that is what makes it stick).',
          '- Use the name naturally inside the hook — never forced or repeated to fill space.',
          '- Verse 1 = a specific scene from the story. Verse 2 = what that person changed. Bridge = the most vulnerable, honest line of the whole song.',
          '- Every line must be singable out loud in the given genre. Read it back and cut any line that sounds like prose.',
        ].join('\n')
      : [
          'Requisitos:',
          '- Duracion: una cancion COMPLETA de unos 2 minutos.',
          '- Estructura, en este orden exacto, cada etiqueta en su propia linea: [verse] [chorus] [verse] [chorus] [bridge] [chorus].',
          '- Estrofas: 4 versos cada una, de 7 a 10 silabas por verso. Estribillo: 4 versos, con el gancho primero y repetido como ultimo verso.',
          '- El estribillo debe ser IDENTICO cada vez que aparece (asi es como se queda pegado).',
          '- Usa el nombre con naturalidad dentro del gancho — nunca forzado ni repetido para rellenar.',
          '- Estrofa 1 = una escena concreta de la historia. Estrofa 2 = lo que esa persona cambio. Puente = el verso mas vulnerable y honesto de toda la cancion.',
          '- Cada verso debe poder cantarse en voz alta en el genero indicado. Reléelo y elimina cualquier verso que suene a prosa.',
        ].join('\n'),
    isEn
      ? 'Respond with ONLY valid JSON, no markdown, no extra text: {"title": "...", "lyrics": "[verse]\\n...\\n[chorus]\\n..."}'
      : 'Responde SOLO con JSON valido, sin markdown ni texto extra: {"title": "...", "lyrics": "[verse]\\n...\\n[chorus]\\n..."}',
  ].filter(Boolean).join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
