// Lyrics writer. Uses OpenAI (ChatGPT) when OPENAI_API_KEY is set, otherwise
// falls back to MiniMax-Text-01 so the app keeps working without the key.
// Both providers are asked (via buildLyricsMessages) to return strict JSON.
import { buildLyricsMessages, type SongBrief } from './musicPrompts';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const MINIMAX_HOST = process.env.MINIMAX_API_HOST || 'https://api.minimax.io';
const MINIMAX_KEY = process.env.MINIMAX_API_KEY;

export interface Lyrics {
  title: string;
  lyrics: string;
}

type ChatMessage = { role: string; content: string };

// Extract { title, lyrics } from a model response (tolerates extra prose).
function parseLyrics(content: string): Lyrics {
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed?.lyrics) {
        return { title: String(parsed.title || 'Cancion'), lyrics: String(parsed.lyrics) };
      }
    } catch {
      /* fall through */
    }
  }
  if (content.trim()) return { title: 'Cancion', lyrics: content.trim() };
  throw new Error('The model returned no lyrics.');
}

async function viaOpenAI(messages: ChatMessage[]): Promise<Lyrics> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.9,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI (lyrics): ${res.status} ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return parseLyrics(data?.choices?.[0]?.message?.content || '');
}

async function viaMiniMax(messages: ChatMessage[]): Promise<Lyrics> {
  const res = await fetch(`${MINIMAX_HOST}/v1/text/chatcompletion_v2`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MINIMAX_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'MiniMax-Text-01', messages, temperature: 0.9, max_tokens: 1500 }),
  });
  const data = await res.json();
  if (data?.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax (lyrics): ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }
  return parseLyrics(data?.choices?.[0]?.message?.content || '');
}

// Write personalized lyrics for a brief. `revisionNotes` asks for a rewrite.
export async function writeLyrics(
  brief: SongBrief,
  language: string,
  revisionNotes?: string,
): Promise<Lyrics> {
  const messages = buildLyricsMessages(brief, language, revisionNotes);
  if (OPENAI_KEY) return viaOpenAI(messages);
  if (MINIMAX_KEY) return viaMiniMax(messages);
  throw new Error('No lyrics provider configured (set OPENAI_API_KEY or MINIMAX_API_KEY).');
}

// Which provider is active (handy for logs / UI hints).
export const LYRICS_PROVIDER = OPENAI_KEY ? 'openai' : 'minimax';
