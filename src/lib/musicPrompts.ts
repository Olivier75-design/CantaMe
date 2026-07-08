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

const VOICE_HINT: Record<string, string> = {
  male: 'voz masculina',
  female: 'voz femenina',
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

// Build the MiniMax music model prompt (style + voice gender + tone).
export function buildStylePrompt(styleId?: string, tone?: string, voiceGender?: string): string {
  const base = STYLE_PROMPTS[styleId || ''] || STYLE_PROMPTS.bachata;
  const voice = VOICE_HINT[voiceGender || 'female'] || VOICE_HINT.female;
  const hint = TONE_HINT[tone || ''] || '';
  return [base, voice, hint ? `tono ${hint}` : ''].filter(Boolean).join(', ');
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
    ? 'You are a professional Latin music songwriter. You write heartfelt, singable lyrics that fit the chosen genre and feel personal.'
    : 'Eres un compositor profesional de musica latina. Escribes letras sentidas y cantables que encajan con el genero elegido y se sienten personales.';

  const user = [
    isEn ? `Write an original song in ${langName} for ${brief.recipientName || 'someone special'}.` : `Escribe una cancion original en ${langName === 'Spanish' ? 'espanol' : langName} para ${brief.recipientName || 'alguien especial'}.`,
    isEn ? `Relationship of the person requesting it: ${brief.relation || 'unspecified'}.` : `Relacion de quien la pide: ${brief.relation || 'sin especificar'}.`,
    isEn ? `Occasion: ${occ}.` : `Ocasion: ${occ}.`,
    isEn ? `Musical style/genre: ${brief.style || 'bachata'}.` : `Estilo/genero musical: ${brief.style || 'bachata'}.`,
    story ? (isEn ? `Personal story / anecdotes to weave in: ${story}` : `Historia / anecdotas personales a incluir: ${story}`) : '',
    brief.message ? (isEn ? `A personal message to convey: ${brief.message}` : `Un mensaje personal a transmitir: ${brief.message}`) : '',
    isEn ? `Emotional tone: ${brief.tone || 'emotional'}.` : `Tono emocional: ${brief.tone || 'emotional'}.`,
    revisionNotes
      ? (isEn
          ? `IMPORTANT — this is a REVISION of a previous song. Apply this change requested by the user and rewrite the lyrics accordingly: ${revisionNotes}`
          : `IMPORTANTE — esta es una REVISIÓN de una canción anterior. Aplica este cambio pedido por el usuario y reescribe la letra en consecuencia: ${revisionNotes}`)
      : '',
    '',
    isEn
      ? 'Requirements: use the recipient name naturally. Write a FULL song of about 2 to 3 minutes: 2 to 3 verses and a catchy chorus repeated at least twice, plus a short bridge. Tag sections with [verse], [chorus] and [bridge]. Make it singable in the given genre.'
      : 'Requisitos: usa el nombre de forma natural. Escribe una cancion COMPLETA de unos 2 a 3 minutos: 2 a 3 estrofas y un estribillo pegadizo repetido al menos dos veces, mas un puente corto. Marca las secciones con [verse], [chorus] y [bridge]. Que sea cantable en el genero indicado.',
    isEn
      ? 'Respond with ONLY valid JSON, no markdown, no extra text: {"title": "...", "lyrics": "[verse]\\n...\\n[chorus]\\n..."}'
      : 'Responde SOLO con JSON valido, sin markdown ni texto extra: {"title": "...", "lyrics": "[verse]\\n...\\n[chorus]\\n..."}',
  ].filter(Boolean).join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
