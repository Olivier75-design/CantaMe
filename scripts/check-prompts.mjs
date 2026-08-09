// Prompt invariants for the MiniMax music model. Run: node scripts/check-prompts.mjs
//
// There is no test framework here, and these are exactly the failures that are
// invisible in code review but audible in the product: a prompt that overruns
// the model's attention budget, or one that contradicts itself so the model
// silently drops half of it. Both have already shipped once (the inaudible
// kids' choir, then "Everyone" rendering as a single voice).

import { readFileSync } from 'node:fs';
import { buildStylePrompt, STYLE_PROMPTS } from '../src/lib/musicPrompts.ts';
import { VOICE_ICONS } from '../src/lib/constants.ts';

// MiniMax dilutes long prompts and drops instructions near the end. 300 is the
// budget recorded in CLAUDE.md, derived from a 364-char prompt that buried the
// choir completely.
const MAX_PROMPT = 300;
const TONES = ['emotional', 'festive', 'romantic', 'funny'];

const failures = [];
const fail = (msg) => failures.push(msg);

// ── 1. Every combination stays inside the attention budget ──────────────
let worst = { len: 0 };
for (const voice of Object.keys(VOICE_ICONS)) {
  for (const style of Object.keys(STYLE_PROMPTS)) {
    for (const tone of TONES) {
      const p = buildStylePrompt(style, tone, voice);
      if (p.length > worst.len) worst = { len: p.length, voice, style, tone, p };
      if (p.length > MAX_PROMPT) {
        fail(`prompt trop long (${p.length} > ${MAX_PROMPT}) pour voice=${voice} style=${style} tone=${tone}`);
      }
    }
  }
}

// ── 2. No self-contradiction: a line-up whose singers trade verses cannot ──
//      also declare the verses are a single lead voice.
for (const voice of Object.keys(VOICE_ICONS)) {
  const p = buildStylePrompt('bachata', 'emotional', voice).toLowerCase();
  const tradesVerses = p.includes('alternando estrofas');
  const versesSoloLead = p.includes('estrofas solo voz principal');
  if (tradesVerses && versesSoloLead) {
    fail(`contradiction pour voice=${voice}: "alternando estrofas" ET "estrofas solo voz principal" dans le meme prompt`);
  }
}

// ── 3. Each option actually names the voices it promises the customer ──────
const REQUIRED = {
  female: ['femenina'],
  male: ['masculina'],
  duo: ['femenina', 'masculina'],
};
for (const [voice, words] of Object.entries(REQUIRED)) {
  const p = buildStylePrompt('bachata', 'emotional', voice).toLowerCase();
  for (const w of words) {
    if (!p.includes(w)) fail(`voice=${voice}: le prompt ne mentionne pas "${w}" -> ${p}`);
  }
}

// ── 4. The three-place sync CLAUDE.md warns about: VOICE_ICONS, VOICE_HINT ──
//      (via buildStylePrompt) and form.voices in BOTH locale files.
const en = JSON.parse(readFileSync(new URL('../src/locales/en.json', import.meta.url), 'utf8'));
const es = JSON.parse(readFileSync(new URL('../src/locales/es.json', import.meta.url), 'utf8'));
for (const key of Object.keys(VOICE_ICONS)) {
  if (!en.form?.voices?.[key]) fail(`form.voices.${key} manquant dans en.json`);
  if (!es.form?.voices?.[key]) fail(`form.voices.${key} manquant dans es.json`);
  // A missing VOICE_HINT silently falls back to "female" — the customer would
  // pick one line-up and hear another.
  const p = buildStylePrompt('bachata', 'emotional', key);
  const fallback = buildStylePrompt('bachata', 'emotional', '__nope__');
  if (key !== 'female' && p === fallback) {
    fail(`voice=${key} retombe sur le prompt par defaut (VOICE_HINT.${key} manquant)`);
  }
}

// ── Report ────────────────────────────────────────────────────────────────
console.log(`prompt le plus long: ${worst.len}/${MAX_PROMPT} car. (voice=${worst.voice} style=${worst.style} tone=${worst.tone})`);
if (failures.length) {
  console.error(`\n❌ ${failures.length} probleme(s):`);
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log(`✅ ${Object.keys(VOICE_ICONS).length} options de voix x ${Object.keys(STYLE_PROMPTS).length} styles x ${TONES.length} tons: tous les invariants passent`);
