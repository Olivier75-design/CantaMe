// Shared song-generation pipeline (MiniMax lyrics + music), used by
// /api/generate-song (preview) and /api/orders/[id] (live revision).
// Audio is uploaded to Supabase Storage instead of local filesystem.
import { randomUUID } from 'node:crypto';
import { buildStylePrompt, buildLyricsMessages, type SongBrief } from './musicPrompts';
import { getSupabaseServer } from './supabase';

const HOST = process.env.MINIMAX_API_HOST || 'https://api.minimax.io';
const KEY = process.env.MINIMAX_API_KEY;

async function generateLyrics(
  brief: SongBrief,
  language: string,
  revisionNotes?: string
): Promise<{ title: string; lyrics: string }> {
  const messages = buildLyricsMessages(brief, language, revisionNotes);
  const res = await fetch(`${HOST}/v1/text/chatcompletion_v2`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'MiniMax-Text-01', messages, temperature: 0.9, max_tokens: 1500 }),
  });
  const data = await res.json();
  if (data?.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax (paroles): ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }
  const content: string = data?.choices?.[0]?.message?.content || '';

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
  throw new Error('MiniMax no devolvio letras.');
}

async function generateMusic(prompt: string, lyrics: string): Promise<Buffer> {
  const res = await fetch(`${HOST}/v1/music_generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'music-2.6',
      prompt,
      lyrics,
      audio_setting: { sample_rate: 44100, bitrate: 256000, format: 'mp3' },
    }),
  });
  const data = await res.json();
  if (data?.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax (musica): ${data?.base_resp?.status_code} ${data?.base_resp?.status_msg}`);
  }
  const hex: string = data?.data?.audio;
  if (!hex) throw new Error('MiniMax no devolvio audio.');
  return Buffer.from(hex, 'hex');
}

export interface GenerateInput extends SongBrief {
  songLanguage?: string;
}

// Full pipeline: lyrics -> music -> uploaded to Supabase Storage. Returns the public URL + metadata.
export async function generateSongFile(
  input: GenerateInput,
  revisionNotes?: string
): Promise<{ audioUrl: string; title: string; lyrics: string }> {
  if (!KEY) {
    throw new Error('MINIMAX_API_KEY manquant cote serveur. Ajoute-le dans .env.local puis redemarre le serveur.');
  }
  const language = input.songLanguage || 'es';

  const { title, lyrics } = await generateLyrics(input, language, revisionNotes);
  const prompt = buildStylePrompt(input.style, input.tone, input.voiceGender);
  const audio = await generateMusic(prompt, lyrics);

  // Upload to Supabase Storage
  const supabase = getSupabaseServer();
  const fileId = randomUUID();
  const filePath = `generated/${fileId}.mp3`;

  const { error: uploadError } = await supabase.storage
    .from('songs')
    .upload(filePath, audio, {
      contentType: 'audio/mpeg',
      upsert: false,
    });

  if (uploadError) {
    console.error('Supabase Storage upload error:', uploadError);
    throw new Error(`Failed to upload audio: ${uploadError.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('songs')
    .getPublicUrl(filePath);

  const audioUrl = publicUrlData.publicUrl;

  return { audioUrl, title, lyrics };
}
